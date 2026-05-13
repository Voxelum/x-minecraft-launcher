// Package yggserver implements the embedded Yggdrasil-protocol HTTP
// server XMCL ships for offline / peer accounts.
//
// The TS port lives in xmcl-runtime/yggdrasilServer/pluginYggdrasilHandler.ts.
// Both expose the same routes (mounted under "/yggdrasil"):
//
//   GET  /                                         service metadata
//   POST /sessionserver/session/minecraft/join     always 240
//   GET  /sessionserver/session/minecraft/hasJoined?username=...
//   GET  /sessionserver/session/minecraft/profile/{uuid}[?unsigned=false]
//   GET  /textures?href=<remote-url>               proxy texture downloads
//
// The launched Minecraft process points authlib-injector at this base
// URL (`-Dauthlibinjector.yggdrasil.prefetched=...`) so cracked / peer
// players appear with their selected skins. The G7 cut starts the
// listener on a free localhost port; G8 will mount the same handler
// behind the `xmcl://launcher/yggdrasil` custom protocol.
package yggserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Profile is the in-memory shape of a game profile the server answers
// with. Mirrors `usermodel.GameProfile` minus persistence noise; the
// caller's Lookup function maps its own model to this type.
type Profile struct {
	ID       string
	Name     string
	Textures Textures
}

// Textures carries the player's skin / cape / elytra URLs.
type Textures struct {
	SKIN   *Texture
	CAPE   *Texture
	ELYTRA *Texture
}

// Texture is one upstream texture URL plus optional metadata. The
// server proxies the URL through `/textures?href=...` so clients can
// fetch even http-only sources.
type Texture struct {
	URL      string
	Metadata map[string]string
}

// Lookup is invoked per request. Returns nil when no profile matches.
type Lookup func(ctx context.Context, idOrName string) *Profile

// Server is the embedded Yggdrasil server.
type Server struct {
	lookup Lookup
	keys   *keyPair

	mu      sync.Mutex
	server  *http.Server
	listen  net.Listener
	baseURL string
}

// New returns a Server with `lookup` wired in. Call Start to bind.
func New(lookup Lookup) *Server {
	return &Server{lookup: lookup, keys: defaultKeys}
}

// Handler returns the bare HTTP handler (without an associated
// listener). Useful when mounting under a custom protocol scheme in
// G8 — the same routes work whether served by net/http directly or
// by Wails asset middleware.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/yggdrasil/", s.route)
	mux.HandleFunc("/yggdrasil", s.route)
	return mux
}

// Start binds the listener on `addr` (use "127.0.0.1:0" for any
// free port) and serves the handler in a goroutine. Returns the
// resolved base URL the launched game should hit.
func (s *Server) Start(addr string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.server != nil {
		return s.baseURL, nil
	}
	l, err := net.Listen("tcp", addr)
	if err != nil {
		return "", fmt.Errorf("yggserver listen %s: %w", addr, err)
	}
	s.listen = l
	srv := &http.Server{
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	s.server = srv
	// Capture the server pointer locally so a racing Close() that
	// zeros `s.server` doesn't surface as a nil-deref inside Serve.
	go func() {
		_ = srv.Serve(l)
	}()
	s.baseURL = "http://" + l.Addr().String() + "/yggdrasil"
	return s.baseURL, nil
}

// BaseURL returns the live `http://host:port/yggdrasil` (empty when
// Start hasn't been called yet).
func (s *Server) BaseURL() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.baseURL
}

// Close stops the server and releases the socket.
func (s *Server) Close() error {
	s.mu.Lock()
	srv := s.server
	s.server = nil
	s.mu.Unlock()
	if srv == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return srv.Shutdown(ctx)
}

// ============================================================
// Routing
// ============================================================

func (s *Server) route(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/yggdrasil")
	switch {
	case rest == "" || rest == "/":
		s.handleMeta(w, r)
	case rest == "/sessionserver/session/minecraft/join" && r.Method == http.MethodPost:
		// authlib-injector / vanilla call this on join — server-side
		// joins are out of scope for the offline server.
		_, _ = io.Copy(io.Discard, r.Body)
		w.WriteHeader(240)
	case strings.HasPrefix(rest, "/sessionserver/session/minecraft/hasJoined") && r.Method == http.MethodGet:
		s.handleHasJoined(w, r)
	case strings.HasPrefix(rest, "/sessionserver/session/minecraft/profile/"):
		s.handleProfile(w, r, rest[len("/sessionserver/session/minecraft/profile/"):])
	case strings.HasPrefix(rest, "/textures"):
		s.handleTextures(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) handleMeta(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	body := map[string]any{
		"meta": map[string]string{
			"implementationName":    "xmcl-offline-server",
			"implementationVersion": "0.0.1",
			"serverName":            "X Minecraft Launcher Offline Server",
		},
		"skinDomains":        []string{"localhost", "127.0.0.1"},
		"signaturePublickey": s.keys.PublicPEM,
	}
	_ = json.NewEncoder(w).Encode(body)
}

func (s *Server) handleHasJoined(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("username")
	if name == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	prof := s.lookup(r.Context(), name)
	if prof == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	body, err := s.encodeProfile(prof, prof.ID, false)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func (s *Server) handleProfile(w http.ResponseWriter, r *http.Request, id string) {
	if id == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	needSign := r.URL.Query().Get("unsigned") == "false"
	prof := s.lookup(r.Context(), id)
	if prof == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	body, err := s.encodeProfile(prof, id, needSign)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

// handleTextures proxies the upstream texture URL so the launched
// game can fetch it through localhost (avoids mixed-content rules
// + lets the renderer cache local files via image://).
func (s *Server) handleTextures(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Query().Get("href")
	if target == "" {
		http.Error(w, "missing href", http.StatusBadRequest)
		return
	}
	parsed, err := url.Parse(target)
	if err != nil {
		http.Error(w, "bad href", http.StatusBadRequest)
		return
	}
	switch parsed.Scheme {
	case "http", "https":
		req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, target, nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		copyHeader(w.Header(), resp.Header, "Content-Type", "Content-Length", "ETag", "Cache-Control")
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
	default:
		// file:// / image:// — skip; renderer-side caches handle these.
		http.Error(w, "unsupported scheme", http.StatusBadRequest)
	}
}

// ============================================================
// Profile encoding + signing
// ============================================================

// texturesInfo is the JSON shape stored in the `textures` property
// per the Mojang protocol. Field names are intentionally camelCase
// (vanilla launcher convention).
type texturesInfo struct {
	Timestamp   int64                       `json:"timestamp"`
	ProfileID   string                      `json:"profileId"`
	ProfileName string                      `json:"profileName"`
	Textures    map[string]textureInfoEntry `json:"textures"`
}

type textureInfoEntry struct {
	URL      string            `json:"url"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// encodeProfile builds the Yggdrasil JSON for a profile. When `sign`
// is true the textures property carries a base64 RSA-SHA1 signature
// the vanilla launcher can verify against the public key.
func (s *Server) encodeProfile(p *Profile, id string, sign bool) ([]byte, error) {
	ti := texturesInfo{
		Timestamp:   time.Now().UnixMilli(),
		ProfileID:   p.ID,
		ProfileName: p.Name,
		Textures:    map[string]textureInfoEntry{},
	}
	addTexture := func(key string, t *Texture) {
		if t == nil || t.URL == "" {
			return
		}
		// Round-trip the URL through the /textures proxy so the
		// game fetches it from localhost.
		proxied := s.baseURL + "/textures?href=" + url.QueryEscape(t.URL)
		ti.Textures[key] = textureInfoEntry{URL: proxied, Metadata: t.Metadata}
	}
	addTexture("SKIN", p.Textures.SKIN)
	addTexture("CAPE", p.Textures.CAPE)
	addTexture("ELYTRA", p.Textures.ELYTRA)

	tiRaw, err := json.Marshal(&ti)
	if err != nil {
		return nil, err
	}
	textureValue := base64.StdEncoding.EncodeToString(tiRaw)

	prop := map[string]any{
		"name":  "textures",
		"value": textureValue,
	}
	if sign {
		sig, err := s.keys.SignSHA1([]byte(textureValue))
		if err != nil {
			return nil, err
		}
		prop["signature"] = base64.StdEncoding.EncodeToString(sig)
	}

	out := map[string]any{
		"id":   id,
		"name": p.Name,
		"properties": []any{
			map[string]any{"name": "uploadableTextures", "value": "skin,cape"},
			prop,
		},
	}
	return json.Marshal(out)
}

// ============================================================
// Helpers
// ============================================================

func copyHeader(dst, src http.Header, keys ...string) {
	for _, k := range keys {
		if v := src.Get(k); v != "" {
			dst.Set(k, v)
		}
	}
}

// ErrNotStarted is returned by callers asking for a URL before Start.
var ErrNotStarted = errors.New("yggserver: not started")
