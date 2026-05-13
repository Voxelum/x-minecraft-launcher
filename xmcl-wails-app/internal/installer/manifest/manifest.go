// Package manifest fetches and caches the Mojang Minecraft version
// manifest. The manifest lists every release / snapshot / beta
// version and points at the per-version JSON URL.
//
// Cache strategy:
//   - First fetch writes `<appData>/manifest/version_manifest.json`.
//   - Subsequent calls within `staleAfter` reuse the cache.
//   - On expiry we re-fetch but fall back to the cached copy when
//     the network is down.
//
// The TS reference uses a similar pattern via `getVersionList()`. The
// manifest URL is overridable so users behind a corporate proxy or
// the BMCLAPI mirror can point elsewhere.

package manifest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/voxelum/xmcl/wails/internal/network"
)

// DefaultManifestURL is Mojang's launchermeta endpoint.
const DefaultManifestURL = "https://launchermeta.mojang.com/mc/game/version_manifest.json"

// Manifest is the parsed launchermeta response.
type Manifest struct {
	Latest struct {
		Release  string `json:"release"`
		Snapshot string `json:"snapshot"`
	} `json:"latest"`
	Versions []Version `json:"versions"`
}

// Version is one entry in the manifest's `versions` array.
type Version struct {
	ID          string `json:"id"`
	Type        string `json:"type"` // release | snapshot | old_beta | old_alpha
	URL         string `json:"url"`
	Time        string `json:"time"`
	ReleaseTime string `json:"releaseTime"`
	SHA1        string `json:"sha1,omitempty"`
}

// FindByID returns the manifest entry with the given id, or nil.
func (m *Manifest) FindByID(id string) *Version {
	for i := range m.Versions {
		if m.Versions[i].ID == id {
			return &m.Versions[i]
		}
	}
	return nil
}

// Fetcher caches the manifest in memory + on disk.
type Fetcher struct {
	client     *network.Client
	cachePath  string
	urls       []string
	staleAfter time.Duration

	mu      sync.Mutex
	cache   *Manifest
	loaded  time.Time
}

// Options carries Fetcher knobs.
type Options struct {
	// CachePath is the on-disk file used for the persistent cache.
	// Required.
	CachePath string
	// URLs is the candidate URL chain to fetch from. The first one
	// to return 2xx wins. When empty we fall back to a single-shot
	// against DefaultManifestURL.
	URLs []string
	// StaleAfter — how long the in-memory copy is considered fresh
	// before another network round-trip is attempted. Zero == 1h.
	StaleAfter time.Duration
}

// NewFetcher constructs a Fetcher.
func NewFetcher(client *network.Client, opts Options) *Fetcher {
	if client == nil {
		panic("manifest: nil client")
	}
	if opts.CachePath == "" {
		panic("manifest: CachePath required")
	}
	if len(opts.URLs) == 0 {
		opts.URLs = []string{DefaultManifestURL}
	}
	if opts.StaleAfter == 0 {
		opts.StaleAfter = time.Hour
	}
	return &Fetcher{
		client:     client,
		cachePath:  opts.CachePath,
		urls:       append([]string(nil), opts.URLs...),
		staleAfter: opts.StaleAfter,
	}
}

// SetURLs replaces the candidate URL chain. Used when the renderer
// flips `apiSetsPreference` between fetches; the cached manifest
// itself is left intact so the change only affects the next refresh.
func (f *Fetcher) SetURLs(urls []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(urls) == 0 {
		f.urls = []string{DefaultManifestURL}
		return
	}
	f.urls = append([]string(nil), urls...)
}

// Get returns the manifest, fetching from network when the cache is
// missing or stale. On network failure we fall back to whatever's on
// disk so the launcher is still usable offline.
func (f *Fetcher) Get(ctx context.Context) (*Manifest, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	// Hot-path: in-memory copy is fresh.
	if f.cache != nil && time.Since(f.loaded) < f.staleAfter {
		return f.cache, nil
	}

	// Try disk cache before network when the caller has no preference
	// (mirrors "use cache while we revalidate" semantics).
	disk := f.loadFromDisk()
	if disk != nil && f.cache == nil {
		f.cache = disk
		f.loaded = diskMTime(f.cachePath)
		// Disk copy still fresh? Skip the network call.
		if time.Since(f.loaded) < f.staleAfter {
			return f.cache, nil
		}
	}

	// Network refresh.
	fresh, err := f.fetch(ctx)
	if err != nil {
		// Fall back to whatever we have in memory or on disk.
		if f.cache != nil {
			return f.cache, nil
		}
		return nil, fmt.Errorf("manifest: fetch and no cache: %w", err)
	}
	f.cache = fresh
	f.loaded = time.Now()
	if err := f.saveToDisk(fresh); err != nil {
		// Caching failure shouldn't block the launcher; just log via
		// the returned manifest.
		return fresh, nil
	}
	return fresh, nil
}

// LatestRelease returns the latest release id from the manifest. A
// thin convenience wrapper over Get; callers that need both release
// and snapshot should call Get directly.
func (f *Fetcher) LatestRelease(ctx context.Context) (string, error) {
	m, err := f.Get(ctx)
	if err != nil {
		return "", err
	}
	return m.Latest.Release, nil
}

// LatestSnapshot returns the latest snapshot id from the manifest.
func (f *Fetcher) LatestSnapshot(ctx context.Context) (string, error) {
	m, err := f.Get(ctx)
	if err != nil {
		return "", err
	}
	return m.Latest.Snapshot, nil
}

// Override forces the cached `latest` block to specific ids, e.g.
// when the renderer received them from a custom source. The manifest
// versions array is left intact.
func (f *Fetcher) Override(release, snapshot string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.cache == nil {
		f.cache = &Manifest{}
	}
	f.cache.Latest.Release = release
	f.cache.Latest.Snapshot = snapshot
}

// ============================================================
// Internals
// ============================================================

func (f *Fetcher) fetch(ctx context.Context) (*Manifest, error) {
	var lastErr error
	for _, u := range f.urls {
		var m Manifest
		if _, err := f.client.GetJSON(ctx, u, &m); err != nil {
			lastErr = err
			continue
		}
		return &m, nil
	}
	if lastErr == nil {
		lastErr = errors.New("manifest: no URLs configured")
	}
	return nil, lastErr
}

func (f *Fetcher) loadFromDisk() *Manifest {
	raw, err := os.ReadFile(f.cachePath)
	if err != nil {
		return nil
	}
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	return &m
}

func (f *Fetcher) saveToDisk(m *Manifest) error {
	if err := os.MkdirAll(filepath.Dir(f.cachePath), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	tmp := f.cachePath + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, f.cachePath)
}

func diskMTime(path string) time.Time {
	info, err := os.Stat(path)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

// ErrNoManifest is the canonical error when a caller asks for a
// version that isn't in the manifest.
var ErrNoManifest = errors.New("manifest: no such version")
