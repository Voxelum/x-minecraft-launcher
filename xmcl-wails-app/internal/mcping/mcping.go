// Package mcping implements the Minecraft "Server List Ping" client
// protocol — both the modern Notchian (≥ 1.7) packet protocol and a
// legacy fallback (≤ 1.6 query) that some hosts still serve.
//
// Spec reference: https://wiki.vg/Server_List_Ping
//
// The result mirrors the JSON payload Mojang's modern servers
// return verbatim (`version`, `players`, `description`, `favicon`)
// plus a `ping` round-trip-time field the renderer renders next to
// the latency icon.
package mcping

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"time"
)

// Status mirrors the renderer-facing `Status` shape (see
// xmcl-runtime-api/src/services/ServerStatusService.ts).
type Status struct {
	Version     map[string]any `json:"version"`
	Players     map[string]any `json:"players"`
	Description any            `json:"description"`
	Favicon     string         `json:"favicon"`
	Modinfo     map[string]any `json:"modinfo,omitempty"`
	Ping        float64        `json:"ping"`
}

// Options carries the dial parameters.
type Options struct {
	Host     string
	Port     int    // defaults to 25565
	Protocol int    // protocol version sent in the handshake; 0 == 47 (1.8)
	Timeout  time.Duration
}

// Ping performs a single status request against `host:port`.
func Ping(ctx context.Context, opts Options) (*Status, error) {
	if opts.Host == "" {
		return nil, errors.New("mcping: host required")
	}
	if opts.Port == 0 {
		opts.Port = 25565
	}
	if opts.Protocol == 0 {
		opts.Protocol = 47 // arbitrary modern default; servers ignore it for SLP
	}
	if opts.Timeout == 0 {
		opts.Timeout = 8 * time.Second
	}

	dctx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	d := net.Dialer{Timeout: opts.Timeout}
	conn, err := d.DialContext(dctx, "tcp", net.JoinHostPort(opts.Host, strconv.Itoa(opts.Port)))
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(opts.Timeout))

	// ====================================================
	// Handshake (packet id 0x00) → state Status (1).
	//   varint protocol
	//   string host
	//   uint16 port
	//   varint next state (1 = status)
	// ====================================================
	hs := encodePacket(0x00, func(buf *byteBuf) {
		buf.writeVarInt(int32(opts.Protocol))
		buf.writeString(opts.Host)
		buf.writeUint16(uint16(opts.Port))
		buf.writeVarInt(1)
	})
	if _, err := conn.Write(hs); err != nil {
		return nil, fmt.Errorf("mcping: write handshake: %w", err)
	}

	// ====================================================
	// Status request (packet id 0x00, no payload).
	// ====================================================
	if _, err := conn.Write(encodePacket(0x00, nil)); err != nil {
		return nil, fmt.Errorf("mcping: write status request: %w", err)
	}

	// ====================================================
	// Status response (packet id 0x00):
	//   varint length
	//   varint id (0x00)
	//   string json
	// ====================================================
	pr := newPacketReader(conn)
	pktLen, err := pr.readVarInt()
	if err != nil {
		return nil, fmt.Errorf("mcping: read status length: %w", err)
	}
	body := make([]byte, pktLen)
	if _, err := io.ReadFull(pr.r, body); err != nil {
		return nil, fmt.Errorf("mcping: read status body: %w", err)
	}
	bb := &byteBuf{data: body}
	id, err := bb.readVarInt()
	if err != nil {
		return nil, err
	}
	if id != 0 {
		return nil, fmt.Errorf("mcping: status: unexpected packet id 0x%02x", id)
	}
	jsonStr, err := bb.readString()
	if err != nil {
		return nil, err
	}

	// ====================================================
	// Ping (packet id 0x01) → pong (id 0x01) for RTT.
	// ====================================================
	now := time.Now()
	payload := now.UnixNano()
	pingPkt := encodePacket(0x01, func(buf *byteBuf) {
		buf.writeInt64(payload)
	})
	if _, err := conn.Write(pingPkt); err != nil {
		// Non-fatal; some servers don't reply to ping.
		jsonResult, parseErr := decodeJSON(jsonStr, 0)
		if parseErr != nil {
			return nil, parseErr
		}
		return jsonResult, nil
	}
	// Read pong.
	rttPing := float64(0)
	if pongLen, err := pr.readVarInt(); err == nil {
		pong := make([]byte, pongLen)
		if _, err := io.ReadFull(pr.r, pong); err == nil {
			rttPing = float64(time.Since(now).Milliseconds())
		}
	}

	return decodeJSON(jsonStr, rttPing)
}

func decodeJSON(s string, rtt float64) (*Status, error) {
	var raw map[string]any
	if err := json.Unmarshal([]byte(s), &raw); err != nil {
		return nil, fmt.Errorf("mcping: parse status json: %w", err)
	}
	out := &Status{Ping: rtt}
	if v, ok := raw["version"].(map[string]any); ok {
		out.Version = v
	}
	if v, ok := raw["players"].(map[string]any); ok {
		out.Players = v
	}
	out.Description = raw["description"]
	if v, ok := raw["favicon"].(string); ok {
		out.Favicon = v
	}
	if v, ok := raw["modinfo"].(map[string]any); ok {
		out.Modinfo = v
	}
	if out.Version == nil {
		out.Version = map[string]any{}
	}
	if out.Players == nil {
		out.Players = map[string]any{}
	}
	return out, nil
}

// ============================================================
// Packet helpers
// ============================================================

// encodePacket prepends the packet body with `<varint length><varint id>`
// and returns the wire bytes.
func encodePacket(id int32, body func(*byteBuf)) []byte {
	inner := &byteBuf{}
	inner.writeVarInt(id)
	if body != nil {
		body(inner)
	}
	out := &byteBuf{}
	out.writeVarInt(int32(len(inner.data)))
	out.data = append(out.data, inner.data...)
	return out.data
}

type packetReader struct {
	r io.Reader
}

func newPacketReader(r io.Reader) *packetReader { return &packetReader{r: r} }

func (p *packetReader) readVarInt() (int32, error) {
	var n int32
	var shift uint
	one := []byte{0}
	for i := 0; i < 5; i++ {
		if _, err := io.ReadFull(p.r, one); err != nil {
			return 0, err
		}
		n |= int32(one[0]&0x7F) << shift
		if one[0]&0x80 == 0 {
			return n, nil
		}
		shift += 7
	}
	return 0, errors.New("mcping: varint overflow")
}

// byteBuf is a tiny append-only buffer with the encode/decode helpers
// the Minecraft protocol uses.
type byteBuf struct {
	data []byte
	pos  int
}

func (b *byteBuf) writeUint16(v uint16) {
	b.data = append(b.data, byte(v>>8), byte(v))
}

func (b *byteBuf) writeInt64(v int64) {
	var tmp [8]byte
	binary.BigEndian.PutUint64(tmp[:], uint64(v))
	b.data = append(b.data, tmp[:]...)
}

func (b *byteBuf) writeVarInt(v int32) {
	uv := uint32(v)
	for {
		if uv&^0x7F == 0 {
			b.data = append(b.data, byte(uv))
			return
		}
		b.data = append(b.data, byte(uv&0x7F)|0x80)
		uv >>= 7
	}
}

func (b *byteBuf) writeString(s string) {
	b.writeVarInt(int32(len(s)))
	b.data = append(b.data, []byte(s)...)
}

func (b *byteBuf) readVarInt() (int32, error) {
	var n int32
	var shift uint
	for i := 0; i < 5; i++ {
		if b.pos >= len(b.data) {
			return 0, errors.New("mcping: short read")
		}
		c := b.data[b.pos]
		b.pos++
		n |= int32(c&0x7F) << shift
		if c&0x80 == 0 {
			return n, nil
		}
		shift += 7
	}
	return 0, errors.New("mcping: varint overflow")
}

func (b *byteBuf) readString() (string, error) {
	n, err := b.readVarInt()
	if err != nil {
		return "", err
	}
	if int(n) > len(b.data)-b.pos {
		return "", errors.New("mcping: string overflows buffer")
	}
	s := string(b.data[b.pos : b.pos+int(n)])
	b.pos += int(n)
	return s, nil
}
