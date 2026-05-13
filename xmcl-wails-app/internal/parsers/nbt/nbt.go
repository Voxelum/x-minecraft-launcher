// Package nbt parses and emits Minecraft's Named Binary Tag format.
//
// It mirrors the read/write surface of the TS package `@xmcl/nbt` but
// drops the prototype-decorator schema system in favour of native Go
// type discrimination:
//
//   NBT type        Go type
//   --------        -------
//   Byte            int8
//   Short           int16
//   Int             int32
//   Long            int64
//   Float           float32
//   Double          float64
//   ByteArray       []int8        (or []byte; both accepted on Write)
//   String          string
//   List            *List         (carries explicit element type)
//   Compound        map[string]any
//   IntArray        []int32
//   LongArray       []int64
//
// `Read` returns a `Compound` (the root must be a named compound per
// the NBT spec). `Write` takes the same shape plus a root name.
//
// Encoding follows the canonical NBT spec used since classic
// Minecraft: big-endian integers, length-prefixed UTF-8 strings.
// String encoding is technically "modified UTF-8" in Java, but for the
// Basic Multilingual Plane (which covers everything Minecraft writes
// in practice) it matches standard UTF-8 byte-for-byte. Astral-plane
// strings round-trip on both sides if both ends consistently use
// standard UTF-8 (which `@xmcl/nbt` does via TextEncoder).
package nbt

import (
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
)

// ============================================================
// Tag types + compression
// ============================================================

const (
	TagEnd       byte = 0
	TagByte      byte = 1
	TagShort     byte = 2
	TagInt       byte = 3
	TagLong      byte = 4
	TagFloat     byte = 5
	TagDouble    byte = 6
	TagByteArray byte = 7
	TagString    byte = 8
	TagList      byte = 9
	TagCompound  byte = 10
	TagIntArray  byte = 11
	TagLongArray byte = 12
)

// Compression selects the wrapper applied to a serialized NBT byte
// stream (and expected on the input stream when reading).
type Compression int

const (
	// None — raw NBT bytes (no compression wrapper).
	None Compression = iota
	// Gzip — RFC 1952 gzip stream. The default for save files.
	Gzip
	// Zlib — RFC 1950 deflate-with-header stream. Used by some chunk
	// payloads and the Realms/Mojang servers list.
	Zlib
)

// List is the explicit list-of-items value. The element type must be
// set even when Items is empty so the writer can emit the correct
// element-type byte. NewList constructs one safely.
type List struct {
	ElementType byte
	Items       []any
}

// NewList builds a List with the given element type and items.
func NewList(elementType byte, items []any) *List {
	return &List{ElementType: elementType, Items: items}
}

// ============================================================
// Read
// ============================================================

// Read decodes an NBT stream rooted at a named compound tag. The root
// name is discarded — `@xmcl/nbt` does the same. Use ReadNamed when
// you need the name back.
func Read(data []byte, compression Compression) (map[string]any, error) {
	_, m, err := ReadNamed(data, compression)
	return m, err
}

// ReadNamed decodes an NBT stream rooted at a named compound tag and
// returns the root name alongside the compound.
func ReadNamed(data []byte, compression Compression) (string, map[string]any, error) {
	r, err := openReader(data, compression)
	if err != nil {
		return "", nil, err
	}
	rd := &reader{r: r}

	tag, err := rd.readByte()
	if err != nil {
		return "", nil, fmt.Errorf("nbt: read root tag type: %w", err)
	}
	if tag == TagEnd {
		return "", nil, errors.New("nbt: end tag at root")
	}
	if tag != TagCompound {
		return "", nil, fmt.Errorf("nbt: root tag must be Compound, got %d", tag)
	}

	name, err := rd.readString()
	if err != nil {
		return "", nil, fmt.Errorf("nbt: read root name: %w", err)
	}
	value, err := rd.readCompound()
	if err != nil {
		return "", nil, fmt.Errorf("nbt: read root compound: %w", err)
	}
	return name, value, nil
}

func openReader(data []byte, c Compression) (io.Reader, error) {
	switch c {
	case None:
		return bytes.NewReader(data), nil
	case Gzip:
		gz, err := gzip.NewReader(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("nbt: gzip header: %w", err)
		}
		out, err := io.ReadAll(gz)
		gz.Close()
		if err != nil {
			return nil, err
		}
		return bytes.NewReader(out), nil
	case Zlib:
		zr, err := zlib.NewReader(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("nbt: zlib header: %w", err)
		}
		out, err := io.ReadAll(zr)
		zr.Close()
		if err != nil {
			return nil, err
		}
		return bytes.NewReader(out), nil
	}
	return nil, fmt.Errorf("nbt: unknown compression %d", c)
}

type reader struct {
	r io.Reader
}

func (r *reader) readByte() (byte, error) {
	var b [1]byte
	_, err := io.ReadFull(r.r, b[:])
	return b[0], err
}

func (r *reader) readFull(n int) ([]byte, error) {
	out := make([]byte, n)
	_, err := io.ReadFull(r.r, out)
	return out, err
}

func (r *reader) readUint16() (uint16, error) {
	b, err := r.readFull(2)
	if err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint16(b), nil
}

func (r *reader) readInt32() (int32, error) {
	b, err := r.readFull(4)
	if err != nil {
		return 0, err
	}
	return int32(binary.BigEndian.Uint32(b)), nil
}

func (r *reader) readInt64() (int64, error) {
	b, err := r.readFull(8)
	if err != nil {
		return 0, err
	}
	return int64(binary.BigEndian.Uint64(b)), nil
}

func (r *reader) readString() (string, error) {
	n, err := r.readUint16()
	if err != nil {
		return "", err
	}
	if n == 0 {
		return "", nil
	}
	b, err := r.readFull(int(n))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (r *reader) readPayload(tag byte) (any, error) {
	switch tag {
	case TagByte:
		b, err := r.readByte()
		return int8(b), err
	case TagShort:
		v, err := r.readUint16()
		return int16(v), err
	case TagInt:
		return r.readInt32()
	case TagLong:
		return r.readInt64()
	case TagFloat:
		v, err := r.readInt32()
		return float32FromBits(uint32(v)), err
	case TagDouble:
		v, err := r.readInt64()
		return float64FromBits(uint64(v)), err
	case TagByteArray:
		n, err := r.readInt32()
		if err != nil {
			return nil, err
		}
		raw, err := r.readFull(int(n))
		if err != nil {
			return nil, err
		}
		out := make([]int8, n)
		for i := range raw {
			out[i] = int8(raw[i])
		}
		return out, nil
	case TagString:
		return r.readString()
	case TagList:
		return r.readList()
	case TagCompound:
		return r.readCompound()
	case TagIntArray:
		n, err := r.readInt32()
		if err != nil {
			return nil, err
		}
		out := make([]int32, n)
		for i := range out {
			v, err := r.readInt32()
			if err != nil {
				return nil, err
			}
			out[i] = v
		}
		return out, nil
	case TagLongArray:
		n, err := r.readInt32()
		if err != nil {
			return nil, err
		}
		out := make([]int64, n)
		for i := range out {
			v, err := r.readInt64()
			if err != nil {
				return nil, err
			}
			out[i] = v
		}
		return out, nil
	}
	return nil, fmt.Errorf("nbt: unknown tag type %d", tag)
}

func (r *reader) readList() (*List, error) {
	elemType, err := r.readByte()
	if err != nil {
		return nil, err
	}
	n, err := r.readInt32()
	if err != nil {
		return nil, err
	}
	items := make([]any, n)
	for i := range items {
		v, err := r.readPayload(elemType)
		if err != nil {
			return nil, err
		}
		items[i] = v
	}
	return &List{ElementType: elemType, Items: items}, nil
}

func (r *reader) readCompound() (map[string]any, error) {
	out := map[string]any{}
	for {
		tag, err := r.readByte()
		if err != nil {
			return nil, err
		}
		if tag == TagEnd {
			return out, nil
		}
		key, err := r.readString()
		if err != nil {
			return nil, err
		}
		val, err := r.readPayload(tag)
		if err != nil {
			return nil, err
		}
		out[key] = val
	}
}

// ============================================================
// Write
// ============================================================

// Write serializes a Compound (map[string]any) into the NBT format
// with the given compression and optional root name. Use empty string
// for `rootName` to mirror the TS default.
func Write(value map[string]any, compression Compression, rootName string) ([]byte, error) {
	var buf bytes.Buffer
	w := &writer{w: &buf}
	if err := w.writeByte(TagCompound); err != nil {
		return nil, err
	}
	if err := w.writeString(rootName); err != nil {
		return nil, err
	}
	if err := w.writeCompound(value); err != nil {
		return nil, err
	}
	return wrapCompression(buf.Bytes(), compression)
}

func wrapCompression(data []byte, c Compression) ([]byte, error) {
	switch c {
	case None:
		return data, nil
	case Gzip:
		var out bytes.Buffer
		gz := gzip.NewWriter(&out)
		if _, err := gz.Write(data); err != nil {
			return nil, err
		}
		if err := gz.Close(); err != nil {
			return nil, err
		}
		return out.Bytes(), nil
	case Zlib:
		var out bytes.Buffer
		zw := zlib.NewWriter(&out)
		if _, err := zw.Write(data); err != nil {
			return nil, err
		}
		if err := zw.Close(); err != nil {
			return nil, err
		}
		return out.Bytes(), nil
	}
	return nil, fmt.Errorf("nbt: unknown compression %d", c)
}

type writer struct {
	w *bytes.Buffer
}

func (w *writer) writeByte(b byte) error {
	return w.w.WriteByte(b)
}

func (w *writer) writeBytes(b []byte) error {
	_, err := w.w.Write(b)
	return err
}

func (w *writer) writeUint16(v uint16) error {
	var b [2]byte
	binary.BigEndian.PutUint16(b[:], v)
	return w.writeBytes(b[:])
}

func (w *writer) writeInt32(v int32) error {
	var b [4]byte
	binary.BigEndian.PutUint32(b[:], uint32(v))
	return w.writeBytes(b[:])
}

func (w *writer) writeInt64(v int64) error {
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], uint64(v))
	return w.writeBytes(b[:])
}

func (w *writer) writeString(s string) error {
	bs := []byte(s)
	if len(bs) > 65535 {
		return fmt.Errorf("nbt: string too long (%d bytes, max 65535)", len(bs))
	}
	if err := w.writeUint16(uint16(len(bs))); err != nil {
		return err
	}
	return w.writeBytes(bs)
}

func (w *writer) writePayload(tag byte, value any) error {
	switch tag {
	case TagByte:
		v, err := coerceInt8(value)
		if err != nil {
			return err
		}
		return w.writeByte(byte(v))
	case TagShort:
		v, err := coerceInt16(value)
		if err != nil {
			return err
		}
		return w.writeUint16(uint16(v))
	case TagInt:
		v, err := coerceInt32(value)
		if err != nil {
			return err
		}
		return w.writeInt32(v)
	case TagLong:
		v, err := coerceInt64(value)
		if err != nil {
			return err
		}
		return w.writeInt64(v)
	case TagFloat:
		v, err := coerceFloat32(value)
		if err != nil {
			return err
		}
		return w.writeInt32(int32(float32Bits(v)))
	case TagDouble:
		v, err := coerceFloat64(value)
		if err != nil {
			return err
		}
		return w.writeInt64(int64(float64Bits(v)))
	case TagByteArray:
		raw, err := coerceByteArray(value)
		if err != nil {
			return err
		}
		if err := w.writeInt32(int32(len(raw))); err != nil {
			return err
		}
		return w.writeBytes(raw)
	case TagString:
		s, ok := value.(string)
		if !ok {
			return fmt.Errorf("nbt: expected string, got %T", value)
		}
		return w.writeString(s)
	case TagList:
		l, err := coerceList(value)
		if err != nil {
			return err
		}
		return w.writeList(l)
	case TagCompound:
		m, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("nbt: expected map[string]any, got %T", value)
		}
		return w.writeCompound(m)
	case TagIntArray:
		arr, err := coerceInt32Array(value)
		if err != nil {
			return err
		}
		if err := w.writeInt32(int32(len(arr))); err != nil {
			return err
		}
		for _, v := range arr {
			if err := w.writeInt32(v); err != nil {
				return err
			}
		}
		return nil
	case TagLongArray:
		arr, err := coerceInt64Array(value)
		if err != nil {
			return err
		}
		if err := w.writeInt32(int32(len(arr))); err != nil {
			return err
		}
		for _, v := range arr {
			if err := w.writeInt64(v); err != nil {
				return err
			}
		}
		return nil
	}
	return fmt.Errorf("nbt: unknown tag type %d", tag)
}

func (w *writer) writeList(l *List) error {
	if err := w.writeByte(l.ElementType); err != nil {
		return err
	}
	if err := w.writeInt32(int32(len(l.Items))); err != nil {
		return err
	}
	for _, item := range l.Items {
		if err := w.writePayload(l.ElementType, item); err != nil {
			return err
		}
	}
	return nil
}

func (w *writer) writeCompound(m map[string]any) error {
	for key, val := range m {
		tag, err := inferTag(val)
		if err != nil {
			return fmt.Errorf("nbt: compound key %q: %w", key, err)
		}
		if err := w.writeByte(tag); err != nil {
			return err
		}
		if err := w.writeString(key); err != nil {
			return err
		}
		if err := w.writePayload(tag, val); err != nil {
			return err
		}
	}
	return w.writeByte(TagEnd)
}

// inferTag picks the NBT tag type for a Go value based on its concrete
// type. Untyped numeric constants don't survive into `any`, so callers
// who care about precision should use the typed wrapper (int8 ↔ Byte,
// int32 ↔ Int, etc.). Plain `int` defaults to Long because it's the
// safest representation on 64-bit hosts; ditto `float64` → Double.
func inferTag(v any) (byte, error) {
	switch v := v.(type) {
	case int8:
		return TagByte, nil
	case int16:
		return TagShort, nil
	case int32:
		return TagInt, nil
	case int64, int:
		_ = v
		return TagLong, nil
	case float32:
		return TagFloat, nil
	case float64:
		return TagDouble, nil
	case []int8, []byte:
		return TagByteArray, nil
	case string:
		return TagString, nil
	case *List:
		return TagList, nil
	case map[string]any:
		return TagCompound, nil
	case []int32:
		return TagIntArray, nil
	case []int64:
		return TagLongArray, nil
	}
	return 0, fmt.Errorf("unsupported value type %T", v)
}

// ============================================================
// Coercion helpers — accept the most common adjacent Go types so
// callers don't have to convert at every assignment site.
// ============================================================

func coerceInt8(v any) (int8, error) {
	switch v := v.(type) {
	case int8:
		return v, nil
	case int:
		return int8(v), nil
	case int32:
		return int8(v), nil
	case int64:
		return int8(v), nil
	}
	return 0, fmt.Errorf("nbt: expected Byte (int8), got %T", v)
}

func coerceInt16(v any) (int16, error) {
	switch v := v.(type) {
	case int16:
		return v, nil
	case int:
		return int16(v), nil
	case int32:
		return int16(v), nil
	case int64:
		return int16(v), nil
	}
	return 0, fmt.Errorf("nbt: expected Short (int16), got %T", v)
}

func coerceInt32(v any) (int32, error) {
	switch v := v.(type) {
	case int32:
		return v, nil
	case int:
		return int32(v), nil
	case int64:
		return int32(v), nil
	case int16:
		return int32(v), nil
	}
	return 0, fmt.Errorf("nbt: expected Int (int32), got %T", v)
}

func coerceInt64(v any) (int64, error) {
	switch v := v.(type) {
	case int64:
		return v, nil
	case int:
		return int64(v), nil
	case int32:
		return int64(v), nil
	}
	return 0, fmt.Errorf("nbt: expected Long (int64), got %T", v)
}

func coerceFloat32(v any) (float32, error) {
	switch v := v.(type) {
	case float32:
		return v, nil
	case float64:
		return float32(v), nil
	}
	return 0, fmt.Errorf("nbt: expected Float (float32), got %T", v)
}

func coerceFloat64(v any) (float64, error) {
	switch v := v.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	}
	return 0, fmt.Errorf("nbt: expected Double (float64), got %T", v)
}

func coerceByteArray(v any) ([]byte, error) {
	switch v := v.(type) {
	case []byte:
		return v, nil
	case []int8:
		out := make([]byte, len(v))
		for i, x := range v {
			out[i] = byte(x)
		}
		return out, nil
	}
	return nil, fmt.Errorf("nbt: expected ByteArray ([]int8 / []byte), got %T", v)
}

func coerceInt32Array(v any) ([]int32, error) {
	if a, ok := v.([]int32); ok {
		return a, nil
	}
	return nil, fmt.Errorf("nbt: expected IntArray ([]int32), got %T", v)
}

func coerceInt64Array(v any) ([]int64, error) {
	if a, ok := v.([]int64); ok {
		return a, nil
	}
	return nil, fmt.Errorf("nbt: expected LongArray ([]int64), got %T", v)
}

func coerceList(v any) (*List, error) {
	if l, ok := v.(*List); ok {
		return l, nil
	}
	return nil, fmt.Errorf("nbt: expected *List, got %T (use NewList)", v)
}

// ============================================================
// IEEE-754 helpers
// ============================================================

func float32Bits(f float32) uint32       { return math.Float32bits(f) }
func float64Bits(f float64) uint64       { return math.Float64bits(f) }
func float32FromBits(u uint32) float32   { return math.Float32frombits(u) }
func float64FromBits(u uint64) float64   { return math.Float64frombits(u) }
