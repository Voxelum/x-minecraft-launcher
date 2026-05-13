package host

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"time"
)

// SettingsStore owns the launcher-wide `Settings` payload mirrored to
// disk. The store debounces writes (one second after the last mutation)
// and re-fans live changes back to subscribers via the SharedState
// machinery (wired in the BaseService).
type SettingsStore[T any] struct {
	path     string
	logger   *slog.Logger
	defaults func() *T

	mu      sync.Mutex
	current *T

	saveCh chan struct{}
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// SettingsConfig parameterises NewSettingsStore.
type SettingsConfig[T any] struct {
	// Path defaults to `<AppDataPath>/setting.json` when empty.
	Path string
	// Defaults supplies a freshly-allocated, fully-initialised payload.
	// Required.
	Defaults func() *T
	// Logger receives load/save notices and errors. Optional.
	Logger *slog.Logger
}

// NewSettingsStore creates the store and reads the on-disk file (if
// any). Decode errors fall back to defaults; the new defaults are then
// flushed back to disk on the next mutation.
func NewSettingsStore[T any](appDataPath string, cfg SettingsConfig[T]) *SettingsStore[T] {
	if cfg.Defaults == nil {
		panic("host.NewSettingsStore: Defaults is required")
	}
	path := cfg.Path
	if path == "" {
		path = filepath.Join(appDataPath, "setting.json")
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	s := &SettingsStore[T]{
		path:     path,
		logger:   logger,
		defaults: cfg.Defaults,
		saveCh:   make(chan struct{}, 1),
		stopCh:   make(chan struct{}),
	}
	s.current = s.load()
	s.wg.Add(1)
	go s.saverLoop()
	return s
}

// Get returns a pointer to the live settings payload. Mutations through
// this pointer must call MarkDirty to schedule a flush.
func (s *SettingsStore[T]) Get() *T {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.current
}

// MarkDirty schedules a debounced save. Safe to call from any goroutine.
func (s *SettingsStore[T]) MarkDirty() {
	select {
	case s.saveCh <- struct{}{}:
	default:
		// Already pending — the next debounce window will pick it up.
	}
}

// Close flushes pending writes and stops the background saver.
func (s *SettingsStore[T]) Close(ctx context.Context) error {
	close(s.stopCh)
	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
		return ctx.Err()
	}
	return s.save()
}

// SetField uses reflection to assign payload field `name` to `value`.
// Returns false when no such field exists or the value type doesn't
// match the destination field. The change is scheduled for save.
//
// Used by BaseService to wire all `<field>Set` mutators in one shot
// without having to override 30+ Apply hooks by hand.
func (s *SettingsStore[T]) SetField(name string, value any) bool {
	s.mu.Lock()
	v := reflect.ValueOf(s.current).Elem().FieldByName(name)
	if !v.IsValid() || !v.CanSet() {
		s.mu.Unlock()
		return false
	}
	rv := reflect.ValueOf(value)
	if !rv.IsValid() {
		v.Set(reflect.Zero(v.Type()))
		s.mu.Unlock()
		s.MarkDirty()
		return true
	}
	if !rv.Type().AssignableTo(v.Type()) {
		// Try a JSON round-trip to coerce numerics (float64↔int) and
		// loosely-typed maps that come off the wire as `any`.
		raw, err := json.Marshal(value)
		if err != nil {
			s.mu.Unlock()
			return false
		}
		dst := reflect.New(v.Type())
		if err := json.Unmarshal(raw, dst.Interface()); err != nil {
			s.mu.Unlock()
			return false
		}
		v.Set(dst.Elem())
	} else {
		v.Set(rv)
	}
	s.mu.Unlock()
	s.MarkDirty()
	return true
}

// ============================================================
// Internals
// ============================================================

func (s *SettingsStore[T]) load() *T {
	defaults := s.defaults()

	data, err := os.ReadFile(s.path)
	if err != nil {
		if !os.IsNotExist(err) {
			s.logger.Warn("settings: read failed; using defaults", "err", err)
		}
		return defaults
	}
	if err := json.Unmarshal(data, defaults); err != nil {
		s.logger.Warn("settings: parse failed; using defaults", "err", err)
		return s.defaults()
	}
	return defaults
}

func (s *SettingsStore[T]) save() error {
	s.mu.Lock()
	snapshot := *s.current
	s.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return fmt.Errorf("settings: mkdir: %w", err)
	}
	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return fmt.Errorf("settings: marshal: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("settings: write tmp: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("settings: rename: %w", err)
	}
	return nil
}

// saverLoop coalesces save requests into a 1-second debounce window.
// Mirrors the AggregateExecutor used by the TS pluginSettings.
func (s *SettingsStore[T]) saverLoop() {
	defer s.wg.Done()
	const debounce = time.Second
	timer := time.NewTimer(debounce)
	if !timer.Stop() {
		<-timer.C
	}
	pending := false
	for {
		select {
		case <-s.saveCh:
			if !pending {
				pending = true
				timer.Reset(debounce)
			}
		case <-timer.C:
			if pending {
				pending = false
				if err := s.save(); err != nil {
					s.logger.Error("settings: save failed", "err", err)
				}
			}
		case <-s.stopCh:
			if pending {
				if err := s.save(); err != nil {
					s.logger.Error("settings: final save failed", "err", err)
				}
			}
			return
		}
	}
}
