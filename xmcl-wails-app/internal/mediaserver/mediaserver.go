// Package mediaserver provides Wails AssetServer middleware that
// serves the launcher's "media" URL family that the renderer uses
// for image / video / audio / font assets:
//
//   - GET /media?path=<absolute>
//   - GET /theme-media/<filename>
//   - GET /instance-theme-media/<filename>?instancePath=<absolute>
//   - *   /proxy?url=<absolute> — CORS-bypass proxy for external
//     HTTP(S) GET / HEAD calls the renderer used to make through
//     the Electron main process. Wails v3 runs the WebView on a
//     real origin (`http://wails.localhost`) so cross-origin
//     fetches now go through real browser CORS checks; the
//     legacy launcher's `fetch('https://bmclapi2.bangbang93.com/…')`
//     paths therefore fail with "blocked by CORS policy". The
//     renderer-side `installMediaUrlShim.ts` rewrites those
//     URLs to land here.
//
// The legacy Electron host registered these paths under
// `http://launcher/...` via `protocol.handle('http')`. Wails v3
// alpha.89 only routes `http://wails.localhost/...` requests through
// the user-supplied AssetServer middleware, so the renderer-side
// shim rewrites `http://launcher/` → `http://wails.localhost/` and
// the middleware handles the path family regardless of host.
package mediaserver

import (
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/host"
)

// New returns a Wails AssetServer middleware that serves the
// launcher's media path family before falling through to `next`
// (the static-asset server backing the renderer).
func New(h *host.Host) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if handle(h, w, r) {
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// handle returns true when the request matched a media path and a
// response (success or 4xx) was written.
func handle(h *host.Host, w http.ResponseWriter, r *http.Request) bool {
	path := r.URL.Path
	switch {
	case path == "/media":
		serveMedia(h, w, r)
		return true
	case strings.HasPrefix(path, "/theme-media/"):
		serveThemeMedia(h, w, r, strings.TrimPrefix(path, "/theme-media/"))
		return true
	case strings.HasPrefix(path, "/instance-theme-media/"):
		serveInstanceThemeMedia(h, w, r, strings.TrimPrefix(path, "/instance-theme-media/"))
		return true
	case path == "/proxy":
		serveProxy(h, w, r)
		return true
	}
	return false
}

// serveMedia handles `GET /media?path=<absolute file>`.
func serveMedia(_ *host.Host, w http.ResponseWriter, r *http.Request) {
	abs := r.URL.Query().Get("path")
	if abs == "" {
		http.Error(w, "missing path", http.StatusBadRequest)
		return
	}
	serveFile(w, r, abs)
}

// serveThemeMedia handles `GET /theme-media/<filename>` rooted at
// `<appDataPath>/theme-media/`.
func serveThemeMedia(h *host.Host, w http.ResponseWriter, r *http.Request, name string) {
	if name == "" {
		http.Error(w, "missing filename", http.StatusBadRequest)
		return
	}
	root := filepath.Join(h.AppDataPath, "theme-media")
	abs, ok := safeJoin(root, name)
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	serveFile(w, r, abs)
}

// serveInstanceThemeMedia handles
// `GET /instance-theme-media/<filename>?instancePath=<absolute>` rooted
// at `<instancePath>/theme/`.
func serveInstanceThemeMedia(_ *host.Host, w http.ResponseWriter, r *http.Request, name string) {
	if name == "" {
		http.Error(w, "missing filename", http.StatusBadRequest)
		return
	}
	instancePath := r.URL.Query().Get("instancePath")
	if instancePath == "" {
		http.Error(w, "missing instancePath", http.StatusBadRequest)
		return
	}
	root := filepath.Join(instancePath, "theme")
	abs, ok := safeJoin(root, name)
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	serveFile(w, r, abs)
}

// serveFile streams `abs` with a sniffed Content-Type. Missing files
// produce a plain 404; permission / read errors collapse to 500.
func serveFile(w http.ResponseWriter, r *http.Request, abs string) {
	abs = filepath.Clean(abs)
	info, err := os.Stat(abs)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.NotFound(w, r)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if info.IsDir() {
		http.Error(w, "is a directory", http.StatusForbidden)
		return
	}
	f, err := os.Open(abs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer f.Close()
	if ct := contentTypeForExt(filepath.Ext(abs)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}

// safeJoin joins root + name and returns (abs, true) when the result
// stays under root. The legacy plugin only allowed flat filenames
// (basename), but URL-encoded subpaths are used in the wild for theme
// asset trees, so we accept relative paths as long as they don't
// escape via `..`.
func safeJoin(root, name string) (string, bool) {
	root = filepath.Clean(root)
	abs := filepath.Clean(filepath.Join(root, name))
	rel, err := filepath.Rel(root, abs)
	if err != nil || strings.HasPrefix(rel, "..") || rel == ".." {
		return "", false
	}
	return abs, true
}

// contentTypeForExt covers the image / video / audio / font set the
// renderer uses. Falls back to "" so http.ServeContent's sniffer
// runs.
func contentTypeForExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".bmp":
		return "image/bmp"
	case ".ico":
		return "image/x-icon"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".ttf":
		return "font/ttf"
	case ".otf":
		return "font/otf"
	}
	return ""
}

// ============================================================
// CORS-bypass proxy
// ============================================================

// serveProxy forwards `/proxy?url=<absolute>` to the given upstream
// URL via the host's network client and streams the response back
// with `Access-Control-Allow-Origin: *` so the renderer's
// cross-origin `fetch` resolves.
//
// Accepted upstream schemes: `http`, `https`. Accepted methods:
// every standard HTTP verb except CONNECT/TRACE; the request body
// (if any) is forwarded verbatim. Cookies / Authorization headers
// are NOT forwarded — cross-origin auth flows must go through a
// service method.
func serveProxy(h *host.Host, w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight. The renderer's fetch wrapper might
	// route a preflight here when `init` carries non-simple headers.
	if r.Method == http.MethodOptions {
		setProxyCORS(w)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch r.Method {
	case http.MethodGet, http.MethodHead,
		http.MethodPost, http.MethodPut,
		http.MethodPatch, http.MethodDelete:
		// allowed
	default:
		setProxyCORS(w)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	raw := r.URL.Query().Get("url")
	if raw == "" {
		setProxyCORS(w)
		http.Error(w, "missing url", http.StatusBadRequest)
		return
	}
	upstream, err := url.Parse(raw)
	if err != nil || (upstream.Scheme != "http" && upstream.Scheme != "https") {
		setProxyCORS(w)
		http.Error(w, "bad url", http.StatusBadRequest)
		return
	}

	var body io.Reader
	if r.Body != nil && r.Method != http.MethodGet && r.Method != http.MethodHead {
		body = r.Body
	}
	req, err := http.NewRequestWithContext(r.Context(), r.Method, upstream.String(), body)
	if err != nil {
		setProxyCORS(w)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	// Forward a small allowlist of request headers. Cookies / auth
	// are intentionally NOT forwarded (the renderer never relies on
	// them for these calls, and forwarding them would leak local
	// cookies set by the asset server's origin).
	for _, name := range []string{
		"Accept", "Accept-Language", "Range",
		"If-None-Match", "If-Modified-Since",
		"Content-Type", "Content-Length",
	} {
		if v := r.Header.Get(name); v != "" {
			req.Header.Set(name, v)
		}
	}
	decorateUpstream(h, req, upstream)

	resp, err := h.HTTP.Do(req)
	if err != nil {
		if h.Logger != nil {
			h.Logger.Debug("mediaserver: proxy upstream error", "url", upstream.String(), "err", err)
		}
		setProxyCORS(w)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Forward a small allowlist of response headers + every CORS
	// header so the renderer can read the body cleanly.
	out := w.Header()
	for _, name := range []string{"Content-Type", "Content-Length", "Cache-Control", "ETag", "Last-Modified", "Content-Encoding", "Content-Range", "Accept-Ranges"} {
		if v := resp.Header.Get(name); v != "" {
			out.Set(name, v)
		}
	}
	setProxyCORS(w)
	w.WriteHeader(resp.StatusCode)
	if r.Method != http.MethodHead {
		_, _ = io.Copy(w, resp.Body)
	}
}

// setProxyCORS writes the wildcard-CORS headers the renderer needs to
// read a cross-origin proxy response.
func setProxyCORS(w http.ResponseWriter) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Accept, Accept-Language, Range, If-None-Match, If-Modified-Since, Content-Type, Content-Length")
	// The renderer doesn't carry credentials, but expose common
	// response headers so it can read content-type / content-length.
	h.Set("Access-Control-Expose-Headers", "Content-Type, Content-Length, ETag, Last-Modified, Content-Range, Accept-Ranges")
}

// decorateUpstream injects authority-specific headers onto a proxied
// request before it leaves the launcher. Mirrors the Electron host's
// `pluginApiFallback.ts`: CurseForge gets `x-api-key`, and the
// xmcl.app translation endpoint gets the same key (it's a CurseForge
// translation passthrough).
func decorateUpstream(h *host.Host, req *http.Request, upstream *url.URL) {
	host := strings.ToLower(upstream.Hostname())
	switch host {
	case "api.curseforge.com":
		if h != nil && h.CurseforgeAPIKey != "" {
			req.Header.Set("x-api-key", h.CurseforgeAPIKey)
		}
	case "api.xmcl.app", "api-xmcl.0xc.cn":
		if strings.HasPrefix(upstream.Path, "/translation") &&
			h != nil && h.CurseforgeAPIKey != "" {
			req.Header.Set("x-api-key", h.CurseforgeAPIKey)
		}
	}
}
