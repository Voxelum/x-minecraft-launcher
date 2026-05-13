// Package yggregistry ports xmcl-runtime/user/YggdrasilSeriveRegistry.ts.
// It owns the on-disk list of authlib-injector / Yggdrasil services
// (`<appDataPath>/yggdrasil.json`) and the deduplication logic that
// runs on add.
package yggregistry

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/auth/yggdrasil"
)

const fileName = "yggdrasil.json"

// Defaults are the built-in third-party services preloaded on first
// launch (mirrors getDefaultYggdrasilServices in the TS impl).
var Defaults = []string{
	"https://littleskin.cn/api/yggdrasil",
	"https://authserver.ely.by/api/authlib-injector",
}

// Registry owns the Yggdrasil services list. Safe for concurrent use.
type Registry struct {
	appDataPath string

	mu       sync.RWMutex
	services []yggdrasil.APIProfile
	loaded   bool
}

// New constructs a registry rooted at appDataPath. Call Load() before
// reading.
func New(appDataPath string) *Registry {
	return &Registry{appDataPath: appDataPath}
}

// Load reads `<appDataPath>/yggdrasil.json`, falling back to the
// preloaded defaults on first launch (matching the TS behaviour). The
// network calls used to refresh authlib-injector metadata happen
// in-memory; persistence flushes the resulting list back to disk.
func (r *Registry) Load(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.loaded {
		return nil
	}
	r.loaded = true

	path := filepath.Join(r.appDataPath, fileName)
	raw, err := os.ReadFile(path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}
		// First launch: hydrate defaults from the network. Best-effort;
		// any failure leaves a partial list.
		for _, u := range Defaults {
			r.services = append(r.services, yggdrasil.LoadAPIProfile(ctx, u))
		}
		return r.persistLocked()
	}
	var schema struct {
		YggdrasilServices []yggdrasil.APIProfile `json:"yggdrasilServices"`
	}
	if err := json.Unmarshal(raw, &schema); err != nil {
		return err
	}
	r.services = schema.YggdrasilServices
	return nil
}

// List returns a snapshot of the registered services.
func (r *Registry) List() []yggdrasil.APIProfile {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]yggdrasil.APIProfile, len(r.services))
	copy(out, r.services)
	return out
}

// Find returns the service entry matching authorityURL exactly.
func (r *Registry) Find(authorityURL string) (yggdrasil.APIProfile, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, s := range r.services {
		if s.URL == authorityURL {
			return s, true
		}
	}
	return yggdrasil.APIProfile{}, false
}

// Add fetches the authlib-injector metadata for `apiURL` and inserts
// it into the registry, dedupe'd by host. Mirrors the TS dedup logic
// (replace existing entry only when the new fetch carries
// authlibInjector metadata).
func (r *Registry) Add(ctx context.Context, apiURL string) error {
	apiURL = strings.TrimPrefix(apiURL, "authlib-injector:")
	apiURL = strings.TrimPrefix(apiURL, "yggdrasil-server:")
	if dec, err := url.QueryUnescape(apiURL); err == nil && dec != "" {
		apiURL = dec
	}
	api := yggdrasil.LoadAPIProfile(ctx, apiURL)

	r.mu.Lock()
	defer r.mu.Unlock()
	host := yggdrasil.HostOf(apiURL)
	for i, existing := range r.services {
		if yggdrasil.HostOf(existing.URL) == host {
			if existing.AuthlibInjector != nil && api.AuthlibInjector == nil {
				return nil // keep the better existing entry
			}
			r.services = append(r.services[:i], r.services[i+1:]...)
			break
		}
	}
	r.services = append(r.services, api)
	return r.persistLocked()
}

// Remove drops the entry whose URL equals exactly `apiURL`.
func (r *Registry) Remove(apiURL string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := r.services[:0]
	for _, s := range r.services {
		if s.URL != apiURL {
			out = append(out, s)
		}
	}
	r.services = out
	return r.persistLocked()
}

func (r *Registry) persistLocked() error {
	if err := os.MkdirAll(r.appDataPath, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(map[string]any{
		"yggdrasilServices": r.services,
	}, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(r.appDataPath, fileName+".tmp")
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(r.appDataPath, fileName))
}
