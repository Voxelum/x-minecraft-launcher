// Package elyby implements contract.ElyByService and the
// authlib-replacement helper used by LaunchService when launching
// against `authserver.ely.by`.
//
// Renderer surface: empty interface (nothing is exposed via RPC). The
// generated NotImplemented stub satisfies the contract; the real work
// lives in InstallAuthlib / UncacheElyLibrary which the launch
// middleware calls directly via the host registry.
//
// What the launch middleware does (mirrors xmcl-runtime/elyby/elyByPlugin.ts):
//
//  1. Before launch — if the user's authority is `authserver.ely.by`
//     and the version libraries include `com.mojang:authlib:*`, swap
//     that library out for the Ely.by-patched build returned by
//     `InstallAuthlib(mcVersion)`.
//  2. After a crash with `com.mojang.authlib` in the log — drop the
//     cached entry via `UncacheElyLibrary` so the next launch
//     re-downloads.
package elyby

import (
	"context"
	"crypto/sha1"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"archive/zip"
	"bytes"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// authlibCacheFile is the on-disk record of every per-MC-version
// authlib install. Keyed by full Minecraft version
// ("1.20.4" → {path, sha1, version, exact}).
const authlibCacheFile = "ely-authlib.json"

// metaCacheFile caches the upstream MC↔authlib mapping fetched from
// `https://api.xmcl.app/elyby/authlib`. Stale entries are tolerated;
// the embedded fallback in `cache.json` ships a snapshot from May 2025.
const metaCacheFile = "ely-authlib.cache.json"

//go:embed cache.json
var embeddedCacheJSON []byte

// MetaEntry mirrors xmcl-runtime/elyby/cache.json shape.
type MetaEntry struct {
	Minecraft string `json:"minecraft"`
	ID        string `json:"id"`
	CanForge  bool   `json:"canForge,omitempty"`
}

// AuthlibRecord is one entry in the on-disk install cache.
type AuthlibRecord struct {
	// Path is the absolute on-disk location of the patched jar.
	Path string `json:"path"`
	// SHA1 is the lowercase-hex sha1 of the jar.
	SHA1 string `json:"sha1"`
	// Version is the authlib version string (e.g. "3.13.56").
	Version string `json:"version"`
	// Exact is true when the cache had a perfect MC-version match
	// (vs a "best effort" same-major fallback).
	Exact bool `json:"exact,omitempty"`
}

// Library is the minimal info LaunchService needs to swap the
// authlib library entry. Mirrors `core.ResolvedLibrary` minus the
// rule-evaluation noise.
type Library struct {
	Name     string // maven coord (com.mojang:authlib:VERSION:elyby)
	Path     string // libraries-relative path, posix slashes
	SHA1     string
	Size     int64
	Absolute string // on-disk path
}

// Service is the elyby helper.
type Service struct {
	contract.ElyByServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu sync.Mutex
}

// New constructs the service and registers it on the host registry.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	s := &Service{host: h, states: sm}
	host.Set(h.Registry, s)
	return s
}

var _ contract.ElyByService = (*Service)(nil)

// ============================================================
// Public methods (host-registry consumers)
// ============================================================

// InstallAuthlib returns the patched authlib library entry for
// `minecraftVersion`, downloading from ely.by on cache miss. The
// `exact` boolean reports whether the chosen entry matched the
// Minecraft version exactly (vs a same-major fallback).
//
// Returns (nil, false, nil) when there's no Ely.by mapping for the
// requested version — caller should fall through to vanilla authlib.
func (s *Service) InstallAuthlib(ctx context.Context, minecraftVersion string) (*Library, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cache, _ := s.readCache()
	if rec, ok := cache[minecraftVersion]; ok {
		if hash, err := sha1File(rec.Path); err == nil && hash == rec.SHA1 {
			lib, err := buildLibrary(rec.Path, rec.Version, rec.SHA1)
			if err == nil {
				return lib, rec.Exact, nil
			}
		}
		// Stale / missing — fall through to re-download.
	}

	entries, err := s.metadataEntries(ctx)
	if err != nil {
		return nil, false, err
	}
	primary := primaryVersion(minecraftVersion)
	var match *MetaEntry
	var exact bool
	for i := range entries {
		e := &entries[i]
		if e.Minecraft == minecraftVersion {
			match = e
			exact = true
			break
		}
		if match == nil && strings.HasPrefix(e.Minecraft, primary) {
			match = e
		}
	}
	if match == nil {
		return nil, false, nil
	}
	zipURL := "https://ely.by/minecraft/system/" + match.ID + ".zip"
	rec, err := s.downloadAndExtract(ctx, zipURL, exact)
	if err != nil {
		return nil, false, err
	}
	cache[minecraftVersion] = rec
	if err := s.writeCache(cache); err != nil {
		s.host.Logger.Warn("elyby: persist cache", "err", err)
	}
	lib, err := buildLibrary(rec.Path, rec.Version, rec.SHA1)
	if err != nil {
		return nil, false, err
	}
	return lib, exact, nil
}

// UncacheElyLibrary drops the cached install for `minecraftVersion`
// — used by the launch post-mortem when the patched jar produced an
// `com.mojang.authlib` crash so the next launch re-downloads.
func (s *Service) UncacheElyLibrary(minecraftVersion string, _ bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cache, _ := s.readCache()
	if _, ok := cache[minecraftVersion]; !ok {
		return nil
	}
	delete(cache, minecraftVersion)
	return s.writeCache(cache)
}

// ============================================================
// Cache (on-disk install records)
// ============================================================

func (s *Service) cachePath() string {
	return filepath.Join(s.host.AppDataPath, authlibCacheFile)
}

func (s *Service) readCache() (map[string]AuthlibRecord, error) {
	out := map[string]AuthlibRecord{}
	raw, err := os.ReadFile(s.cachePath())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return out, nil
		}
		return out, err
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return out, err
	}
	return out, nil
}

func (s *Service) writeCache(data map[string]AuthlibRecord) error {
	if err := os.MkdirAll(s.host.AppDataPath, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.cachePath() + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.cachePath())
}

// ============================================================
// Metadata (MC ↔ authlib mapping)
// ============================================================

func (s *Service) metadataEntries(ctx context.Context) ([]MetaEntry, error) {
	if data := s.refreshMetadata(ctx); data != nil {
		return data, nil
	}
	if cached := s.readMetaCache(); cached != nil {
		return cached, nil
	}
	return parseMetaEntries(embeddedCacheJSON)
}

type metaCacheFileShape struct {
	ETag string      `json:"etag,omitempty"`
	Data []MetaEntry `json:"data"`
}

func (s *Service) readMetaCache() []MetaEntry {
	raw, err := os.ReadFile(filepath.Join(s.host.AppDataPath, metaCacheFile))
	if err != nil {
		return nil
	}
	var shape metaCacheFileShape
	if err := json.Unmarshal(raw, &shape); err != nil {
		return nil
	}
	return shape.Data
}

func (s *Service) refreshMetadata(ctx context.Context) []MetaEntry {
	prev := s.readMetaCacheRaw()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.xmcl.app/elyby/authlib", nil)
	if err != nil {
		return nil
	}
	if prev != nil && prev.ETag != "" {
		req.Header.Set("If-None-Match", prev.ETag)
	}
	resp, err := s.host.HTTP.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified && prev != nil {
		return prev.Data
	}
	if resp.StatusCode/100 != 2 {
		return nil
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	entries, err := parseMetaEntries(body)
	if err != nil {
		return nil
	}
	persist := metaCacheFileShape{ETag: resp.Header.Get("ETag"), Data: entries}
	if raw, err := json.MarshalIndent(persist, "", "  "); err == nil {
		_ = os.MkdirAll(s.host.AppDataPath, 0o755)
		_ = os.WriteFile(filepath.Join(s.host.AppDataPath, metaCacheFile), raw, 0o644)
	}
	return entries
}

func (s *Service) readMetaCacheRaw() *metaCacheFileShape {
	raw, err := os.ReadFile(filepath.Join(s.host.AppDataPath, metaCacheFile))
	if err != nil {
		return nil
	}
	var shape metaCacheFileShape
	if err := json.Unmarshal(raw, &shape); err != nil {
		return nil
	}
	return &shape
}

func parseMetaEntries(raw []byte) ([]MetaEntry, error) {
	var entries []MetaEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

// ============================================================
// Download + extract
// ============================================================

// downloadAndExtract pulls the ely.by zip, finds the embedded jar,
// writes it under the launcher's libraries/ tree, and returns a
// fresh AuthlibRecord. We retry up to 3 times on transient failures
// (matches the TS impl).
func (s *Service) downloadAndExtract(ctx context.Context, zipURL string, exact bool) (AuthlibRecord, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, zipURL, nil)
		if err != nil {
			return AuthlibRecord{}, err
		}
		resp, err := s.host.HTTP.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		body, err := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode == 404 {
			return AuthlibRecord{}, fmt.Errorf("elyby: authlib not found at %s", zipURL)
		}
		if resp.StatusCode/100 != 2 {
			lastErr = fmt.Errorf("elyby: HTTP %d for %s", resp.StatusCode, zipURL)
			continue
		}
		rec, err := s.extractFirstJar(body, exact)
		if err == nil {
			return rec, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = errors.New("elyby: failed to install authlib")
	}
	return AuthlibRecord{}, lastErr
}

// extractFirstJar walks the zip archive for the first `.jar` entry
// and writes it under `libraries/com/mojang/authlib/<v>/authlib-<v>-elyby.jar`.
// The version number is parsed from the jar filename
// (`authlib-<v>.jar`).
func (s *Service) extractFirstJar(zipBytes []byte, exact bool) (AuthlibRecord, error) {
	z, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return AuthlibRecord{}, fmt.Errorf("elyby: open zip: %w", err)
	}
	for _, entry := range z.File {
		name := entry.Name
		if !strings.HasSuffix(strings.ToLower(name), ".jar") {
			continue
		}
		base := name
		if i := strings.LastIndexAny(base, "/\\"); i != -1 {
			base = base[i+1:]
		}
		// Expected: authlib-<version>.jar
		if !strings.HasPrefix(base, "authlib-") {
			continue
		}
		version := strings.TrimSuffix(strings.TrimPrefix(base, "authlib-"), ".jar")
		if version == "" {
			continue
		}
		rc, err := entry.Open()
		if err != nil {
			return AuthlibRecord{}, fmt.Errorf("elyby: open jar %s: %w", name, err)
		}
		raw, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			return AuthlibRecord{}, fmt.Errorf("elyby: read jar %s: %w", name, err)
		}
		info := core.ParseLibraryName("com.mojang:authlib:" + version + ":elyby")
		dst := filepath.Join(s.host.MinecraftDataPath, "libraries", filepath.FromSlash(info.Path))
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return AuthlibRecord{}, err
		}
		if err := os.WriteFile(dst, raw, 0o644); err != nil {
			return AuthlibRecord{}, err
		}
		sum := sha1.Sum(raw)
		return AuthlibRecord{
			Path:    dst,
			SHA1:    hex.EncodeToString(sum[:]),
			Version: version,
			Exact:   exact,
		}, nil
	}
	return AuthlibRecord{}, errors.New("elyby: no authlib jar found in zip")
}

// ============================================================
// Helpers
// ============================================================

// primaryVersion returns the "<major>.<minor>" prefix of a Minecraft
// version string, used to find a same-major fallback in the meta map.
func primaryVersion(v string) string {
	parts := strings.SplitN(v, ".", 3)
	if len(parts) < 2 {
		return v
	}
	return parts[0] + "." + parts[1]
}

func sha1File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func buildLibrary(absPath, version, sha1Hex string) (*Library, error) {
	info := core.ParseLibraryName("com.mojang:authlib:" + version + ":elyby")
	st, err := os.Stat(absPath)
	if err != nil {
		return nil, err
	}
	return &Library{
		Name:     info.Name,
		Path:     info.Path,
		SHA1:     sha1Hex,
		Size:     st.Size(),
		Absolute: absPath,
	}, nil
}
