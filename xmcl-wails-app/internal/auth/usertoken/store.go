// Package usertoken ports `xmcl-runtime/user/pluginUserTokenStorage.ts`
// — a thin wrapper around the OS keyring that keys per-authority
// secrets under a stable namespace.
package usertoken

import (
	"errors"
	"net/url"
	"strings"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/host"
)

// Authority kind constants (mirrors `xmcl-runtime-api/util/authority.ts`).
const (
	AuthorityMicrosoft = "x://microsoft"
	AuthorityMojang    = "x://mojang"
	AuthorityDev       = "x://dev"
)

// Store wraps a SecretStorage and adds the in-process cache the TS
// plugin uses to dedupe lookups.
type Store struct {
	secrets host.SecretStorage

	mu    sync.RWMutex
	cache map[string]string
}

// New constructs a token store bound to the given secret backend.
func New(s host.SecretStorage) *Store {
	return &Store{secrets: s, cache: map[string]string{}}
}

// storageKey mirrors the TS getStorageKey routine.
func storageKey(authority string) string {
	switch authority {
	case AuthorityDev:
		return "dev"
	case AuthorityMicrosoft:
		return "microsoft"
	case AuthorityMojang:
		return "mojang"
	}
	if u, err := url.Parse(authority); err == nil && u.Host != "" {
		return strings.ToLower(u.Host)
	}
	return authority
}

func service(authority string) string { return "xmcl/" + storageKey(authority) }

func cacheKey(authority, userID string) string { return service(authority) + "/" + userID }

// Put writes a token for (authority, userID) and updates the in-process cache.
func (s *Store) Put(authority, userID, token string) error {
	if s == nil || s.secrets == nil {
		return errors.New("usertoken: store not initialised")
	}
	s.mu.Lock()
	s.cache[cacheKey(authority, userID)] = token
	s.mu.Unlock()
	return s.secrets.Put(service(authority), userID, token)
}

// Get returns the cached or stored token for (authority, userID).
// Returns ("", nil) when no token is stored.
func (s *Store) Get(authority, userID string) (string, error) {
	if s == nil || s.secrets == nil {
		return "", nil
	}
	s.mu.RLock()
	if v, ok := s.cache[cacheKey(authority, userID)]; ok {
		s.mu.RUnlock()
		return v, nil
	}
	s.mu.RUnlock()
	v, err := s.secrets.Get(service(authority), userID)
	if errors.Is(err, host.ErrSecretNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	s.cache[cacheKey(authority, userID)] = v
	s.mu.Unlock()
	return v, nil
}

// Delete removes a token from both cache and OS keyring.
func (s *Store) Delete(authority, userID string) error {
	if s == nil || s.secrets == nil {
		return nil
	}
	s.mu.Lock()
	delete(s.cache, cacheKey(authority, userID))
	s.mu.Unlock()
	return s.secrets.Delete(service(authority), userID)
}
