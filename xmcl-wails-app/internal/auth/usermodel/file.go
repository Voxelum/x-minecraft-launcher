// Package usermodel ports the on-disk user.json schema from
// `xmcl-runtime-api/src/entities/user.schema.ts`. The persistence
// layer is intentionally permissive: malformed individual entries are
// dropped on load instead of failing the whole file (matching the
// Zod `.catch(...)` semantics in the TS schema).
package usermodel

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const fileName = "user.json"

// Texture is the SKIN/CAPE/ELYTRA texture entry on a GameProfile.
type Texture struct {
	URL      string            `json:"url"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// Textures is the map of texture kinds to URLs.
type Textures struct {
	SKIN   Texture  `json:"SKIN"`
	CAPE   *Texture `json:"CAPE,omitempty"`
	ELYTRA *Texture `json:"ELYTRA,omitempty"`
}

// SkinInfo mirrors xmcl-runtime-api SkinInfoSchema.
type SkinInfo struct {
	ID      string `json:"id"`
	State   string `json:"state"`
	URL     string `json:"url"`
	Variant string `json:"variant"`
}

// CapeInfo mirrors xmcl-runtime-api CapeInfoSchema.
type CapeInfo struct {
	ID    string `json:"id"`
	State string `json:"state"`
	URL   string `json:"url"`
	Alias string `json:"alias,omitempty"`
}

// GameProfile is the in-memory shape of a Yggdrasil game profile.
type GameProfile struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Properties map[string]string `json:"properties,omitempty"`
	Textures   Textures          `json:"textures"`
	Uploadable []string          `json:"uploadable,omitempty"`
	Skins      []SkinInfo        `json:"skins,omitempty"`
	Capes      []CapeInfo        `json:"capes,omitempty"`
}

// Profile mirrors xmcl-runtime-api UserProfileSchema.
type Profile struct {
	ID              string                  `json:"id"`
	Username        string                  `json:"username"`
	Invalidated     bool                    `json:"invalidated"`
	Authority       string                  `json:"authority"`
	ExpiredAt       int64                   `json:"expiredAt"`
	Profiles        map[string]GameProfile  `json:"profiles"`
	SelectedProfile string                  `json:"selectedProfile"`
	Avatar          string                  `json:"avatar,omitempty"`
	HomeAccountID   string                  `json:"homeAccountId,omitempty"`
}

// File is the persisted root.
type File struct {
	Users map[string]Profile `json:"users"`
}

// Load reads `<appDataPath>/user.json`. Missing file → empty File.
func Load(appDataPath string) (*File, error) {
	raw, err := os.ReadFile(filepath.Join(appDataPath, fileName))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &File{Users: map[string]Profile{}}, nil
		}
		return nil, err
	}
	// Permissive parse: drop malformed entries individually instead of
	// rejecting the whole file (matches the Zod `.catch(...)` chain).
	var raw1 struct {
		Users map[string]json.RawMessage `json:"users"`
	}
	if err := json.Unmarshal(raw, &raw1); err != nil {
		// Whole file is malformed — start fresh.
		return &File{Users: map[string]Profile{}}, nil
	}
	out := &File{Users: map[string]Profile{}}
	for k, v := range raw1.Users {
		var p Profile
		if err := json.Unmarshal(v, &p); err == nil && p.ID != "" {
			if p.Profiles == nil {
				p.Profiles = map[string]GameProfile{}
			}
			out.Users[k] = p
		}
	}
	return out, nil
}

// Saver debounces writes the same way the TS impl does (1s tail).
type Saver struct {
	appDataPath string

	mu       sync.Mutex
	pending  *File
	timer    *time.Timer
	flushing sync.Mutex
}

// NewSaver constructs a debounced saver.
func NewSaver(appDataPath string) *Saver { return &Saver{appDataPath: appDataPath} }

// Schedule queues a save of `f`, replacing any pending payload. The
// actual write happens 1s after the last call.
func (s *Saver) Schedule(f *File) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pending = f
	if s.timer == nil {
		s.timer = time.AfterFunc(time.Second, s.flush)
		return
	}
	s.timer.Reset(time.Second)
}

// Flush writes any pending payload immediately.
func (s *Saver) Flush() error {
	s.mu.Lock()
	pending := s.pending
	s.pending = nil
	s.mu.Unlock()
	if pending == nil {
		return nil
	}
	return s.write(pending)
}

func (s *Saver) flush() {
	s.flushing.Lock()
	defer s.flushing.Unlock()
	s.mu.Lock()
	pending := s.pending
	s.pending = nil
	s.mu.Unlock()
	if pending == nil {
		return
	}
	_ = s.write(pending)
}

func (s *Saver) write(f *File) error {
	if err := os.MkdirAll(s.appDataPath, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(s.appDataPath, fileName+".tmp")
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(s.appDataPath, fileName))
}

// MaxSafeInteger95 mirrors `Number.MAX_SAFE_INTEGER / 100 * 95`, the
// "never expires" sentinel the TS code uses for offline accounts.
func MaxSafeInteger95() int64 {
	return int64(math.Pow(2, 53)-1) / 100 * 95
}
