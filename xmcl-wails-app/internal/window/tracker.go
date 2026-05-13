// tracker.go — main-window size/position persistence, mirroring
// `xmcl-electron-app/main/utils/windowSizeTracker.ts`.
//
// We deliberately do NOT persist the "maximized" bit here. Wails v3
// alpha's `IsMaximised()` lies for frameless windows on Windows
// (`IsZoomed` returns true at startup for borderless windows that
// fill the work area), and the matching `WindowMaximise` /
// `WindowUnMaximise` events don't fire reliably across every
// platform/window-style combo — making the persisted bit unreliable.
// The renderer keeps its own ephemeral maximized state via
// `WindowService.GetWindowState`, which is enough for the titlebar
// button glyph to swap correctly during a single session.

package window

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"github.com/voxelum/xmcl/wails/internal/host"
)

// Defaults mirror `xmcl-electron-app/main/defaultApp.ts`.
const (
	MinWidth      = 800
	MinHeight     = 400
	DefaultWidth  = 800
	DefaultHeight = 600
	configFile    = "main-window-config.json"
)

// Config is the persisted shape on disk. Width/Height of 0 (or any
// non-positive value) means "use the default".
type Config struct {
	Width  int  `json:"width"`
	Height int  `json:"height"`
	X      *int `json:"x,omitempty"`
	Y      *int `json:"y,omitempty"`
}

// Tracker loads and persists window geometry. A single Tracker
// instance is safe to share across the lifecycle of one window.
type Tracker struct {
	host *host.Host
	path string

	mu     sync.Mutex
	cfg    Config
	timer  *time.Timer
	dirty  bool
	closed bool
}

// NewTracker constructs a tracker that reads/writes the config file
// for the main window.
func NewTracker(h *host.Host) *Tracker {
	return &Tracker{
		host: h,
		path: filepath.Join(h.AppDataPath, configFile),
	}
}

// Load reads the persisted config, applying width/height/position
// defaults when missing or out-of-range. The on-disk position is
// dropped when it would put the window off every screen — checked
// after the window is created (we don't have screen info here).
func (t *Tracker) Load() Config {
	t.mu.Lock()
	defer t.mu.Unlock()
	data, err := os.ReadFile(t.path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) && t.host != nil && t.host.Logger != nil {
			t.host.Logger.Debug("window: read config", "path", t.path, "err", err)
		}
		return Config{}
	}
	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		if t.host != nil && t.host.Logger != nil {
			t.host.Logger.Debug("window: parse config", "err", err)
		}
		return Config{}
	}
	t.cfg = c
	return c
}

// EffectiveWidth / EffectiveHeight clamp the persisted dimensions
// against the launcher's minimum so a corrupt config can't open a
// 0×0 window.
func (c Config) EffectiveWidth() int {
	if c.Width <= 0 {
		return DefaultWidth
	}
	if c.Width < MinWidth {
		return MinWidth
	}
	return c.Width
}

func (c Config) EffectiveHeight() int {
	if c.Height <= 0 {
		return DefaultHeight
	}
	if c.Height < MinHeight {
		return MinHeight
	}
	return c.Height
}

// HasPosition reports whether a (X, Y) pair was loaded.
func (c Config) HasPosition() bool { return c.X != nil && c.Y != nil }

// Track wires resize/move listeners onto `win`. Each event
// schedules a 1-second debounced flush to disk.
func (t *Tracker) Track(win *application.WebviewWindow) {
	if win == nil {
		return
	}
	updateGeometry := func(_ *application.WindowEvent) {
		w, h := win.Size()
		x, y := win.Position()
		t.mu.Lock()
		t.cfg.Width = w
		t.cfg.Height = h
		t.cfg.X = &x
		t.cfg.Y = &y
		t.dirty = true
		t.mu.Unlock()
		t.scheduleFlush()
	}

	win.OnWindowEvent(events.Common.WindowDidResize, updateGeometry)
	win.OnWindowEvent(events.Common.WindowDidMove, updateGeometry)
	win.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		t.flushNow()
	})
}

func (t *Tracker) scheduleFlush() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.closed {
		return
	}
	if t.timer != nil {
		t.timer.Reset(time.Second)
		return
	}
	t.timer = time.AfterFunc(time.Second, t.flushNow)
}

func (t *Tracker) flushNow() {
	t.mu.Lock()
	if !t.dirty {
		t.mu.Unlock()
		return
	}
	cfg := t.cfg
	t.dirty = false
	t.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(t.path), 0o755); err != nil {
		if t.host != nil && t.host.Logger != nil {
			t.host.Logger.Debug("window: mkdir", "err", err)
		}
		return
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return
	}
	tmp := t.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		if t.host != nil && t.host.Logger != nil {
			t.host.Logger.Debug("window: write config", "err", err)
		}
		return
	}
	if err := os.Rename(tmp, t.path); err != nil {
		if t.host != nil && t.host.Logger != nil {
			t.host.Logger.Debug("window: rename config", "err", err)
		}
	}
}
