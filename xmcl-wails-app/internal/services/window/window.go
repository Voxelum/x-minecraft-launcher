// Package window implements contract.WindowService — per-window
// controls (minimize, maximize, dialogs, clipboard) plus the
// per-window WindowState shared state. CDP-only methods (findInPage,
// startProfiling, flashFrame) are intentionally no-ops per migration
// decision #6.
package window

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.WindowService.
type Service struct {
	contract.WindowServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu       sync.Mutex
	attached map[uint]bool                  // set of WebviewWindow IDs we've wired listeners on
	tracked  map[uint]*windowStatePayload   // current authoritative state per window
}

// New constructs a WindowService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		host:     h,
		states:   sm,
		attached: map[uint]bool{},
		tracked:  map[uint]*windowStatePayload{},
	}
}

// Compile-time assertion that we implement the generated contract.
var _ contract.WindowService = (*Service)(nil)

// errNoWindow is returned when a window-scoped method is called from a
// caller that isn't a renderer (e.g. an internal Go-side test).
var errNoWindow = errors.New("WindowService: no calling window")

func mustWindow(ctx context.Context) (*application.WebviewWindow, error) {
	w := bridge.SenderFromContext(ctx)
	if w == nil {
		return nil, errNoWindow
	}
	return w, nil
}

// ============================================================
// Generated contract method implementations
// ============================================================

func (s *Service) Show(ctx context.Context) (bool, error) {
	w, err := mustWindow(ctx)
	if err != nil {
		return false, err
	}
	w.Show()
	return true, nil
}

func (s *Service) Hide(ctx context.Context) (bool, error) {
	w, err := mustWindow(ctx)
	if err != nil {
		return false, err
	}
	w.Hide()
	return true, nil
}

func (s *Service) Close(ctx context.Context) (bool, error) {
	w, err := mustWindow(ctx)
	if err != nil {
		return false, err
	}
	w.Close()
	return true, nil
}

func (s *Service) Minimize(ctx context.Context) (bool, error) {
	w, err := mustWindow(ctx)
	if err != nil {
		return false, err
	}
	w.Minimise()
	return true, nil
}

func (s *Service) Maximize(ctx context.Context) (bool, error) {
	w, err := mustWindow(ctx)
	if err != nil {
		return false, err
	}
	// Prefer the locally-tracked state over `w.IsMaximised()` —
	// Wails v3 alpha's frameless-window `IsZoomed`/equivalent
	// returns wrong values until the user actually toggles
	// maximize once, which makes the very first click do the
	// opposite of what the user expects.
	wasMaximized := s.isTrackedMaximized(w)
	if wasMaximized {
		w.UnMaximise()
	} else {
		w.Maximise()
	}
	// Authoritatively flip + push the tracked state ourselves.
	// The OS `WindowMaximise` / `WindowUnMaximise` events do
	// fire on Wails v3 alpha *most* of the time but not for
	// every frameless-window/platform combo, so relying on them
	// alone leaves the toggle stuck (clicking the UI button a
	// second time becomes a no-op because the tracked state
	// still says "not maximized"). The event listeners stay
	// wired for OS-driven changes (drag-to-top, win+up,
	// double-click on the titlebar) — they collapse to no-ops
	// when the new value matches the cached one.
	s.setTrackedMaximized(w, !wasMaximized)
	return true, nil
}

// isTrackedMaximized returns the authoritative "is this window
// currently maximized" bit, falling back to false when no state has
// been wired yet (the window is created at the explicit
// non-maximized size in main.go, so `false` is the truth).
func (s *Service) isTrackedMaximized(w *application.WebviewWindow) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.tracked[w.ID()]
	if !ok || p == nil {
		return false
	}
	return p.Maximized
}

// setTrackedMaximized updates the cached maximized bit and pushes a
// `windowMaximized` mutation through the SharedState manager so the
// renderer mirror stays in sync. The persistent `window.Tracker`
// deliberately doesn't store this bit — Wails v3 alpha's
// `IsMaximised()` lies for frameless windows and the OS events
// don't fire reliably, so the maximize state is renderer-ephemeral
// only (it's enough for the titlebar button glyph to swap during
// a single session).
//
// Idempotent — repeated calls with the same value still re-push
// (cheap, and the renderer's reactive layer dedupes the no-op).
func (s *Service) setTrackedMaximized(w *application.WebviewWindow, v bool) {
	s.mu.Lock()
	p, ok := s.tracked[w.ID()]
	if ok && p != nil {
		p.Maximized = v
	}
	s.mu.Unlock()
	if ok && p != nil {
		id := fmt.Sprintf("window://%d", w.ID())
		s.states.Push(id, "windowMaximized", v)
	}
}

func (s *Service) Focus(ctx context.Context) error {
	w, err := mustWindow(ctx)
	if err != nil {
		return err
	}
	w.Focus()
	return nil
}

// SetTranslucent: Wails v3 sets vibrancy at window-construction time;
// runtime toggles aren't widely supported. No-op for G1.
func (s *Service) SetTranslucent(_ context.Context, _ bool) error { return nil }

// QueryAudioPermission: WebView2 / WebKitGTK manage browser permissions
// through navigator.permissions. Always grant from the launcher's POV.
func (s *Service) QueryAudioPermission(_ context.Context) (bool, error) { return true, nil }

// OpenMultiplayerWindow: stubbed for G1 (multi-window arrives in G8).
func (s *Service) OpenMultiplayerWindow(_ context.Context) error { return nil }

// Decisions-dropped methods — keep handlers so legacy renderer calls
// don't error.
func (s *Service) FlashFrame(_ context.Context) error                          { return nil }
func (s *Service) FindInPage(_ context.Context, _ string, _ contract.FindInPageOptions) error {
	return nil
}
func (s *Service) StopFindInPage(_ context.Context) error { return nil }
func (s *Service) StartProfiling(_ context.Context) error { return nil }
func (s *Service) StopProfiling(_ context.Context) error  { return nil }

// Clipboard
func (s *Service) WriteClipboard(_ context.Context, text string) error {
	application.Get().Clipboard.SetText(text)
	return nil
}

// WriteClipboardImage: not implemented in G1; renderer can fall back to
// `navigator.clipboard.write`.
func (s *Service) WriteClipboardImage(_ context.Context, _ string) error { return nil }

// ============================================================
// Dialogs
// ============================================================

func (s *Service) ShowOpenDialog(_ context.Context, options contract.OpenDialogOptions) (contract.OpenDialogResult, error) {
	dlg := application.Get().Dialog.OpenFile().
		SetTitle(strDeref(options.Title)).
		SetMessage(strDeref(options.Message)).
		SetButtonText(strDeref(options.ButtonLabel))

	allowMultiple := false
	for _, p := range options.Properties {
		switch p {
		case "multiSelections":
			allowMultiple = true
		case "openDirectory":
			dlg = dlg.CanChooseDirectories(true).CanChooseFiles(false)
		}
	}
	for _, f := range options.Filters {
		dlg = dlg.AddFilter(f.Name, joinExtensions(f.Extensions))
	}

	if allowMultiple {
		paths, err := dlg.PromptForMultipleSelection()
		if err != nil || len(paths) == 0 {
			return contract.OpenDialogResult{Canceled: true, FilePaths: []string{}}, nil
		}
		return contract.OpenDialogResult{Canceled: false, FilePaths: paths}, nil
	}
	path, err := dlg.PromptForSingleSelection()
	if err != nil || path == "" {
		return contract.OpenDialogResult{Canceled: true, FilePaths: []string{}}, nil
	}
	return contract.OpenDialogResult{Canceled: false, FilePaths: []string{path}}, nil
}

func (s *Service) ShowSaveDialog(_ context.Context, options contract.SaveDialogOptions) (contract.SaveDialogResult, error) {
	dlg := application.Get().Dialog.SaveFile().
		SetMessage(strDeref(options.Message)).
		SetButtonText(strDeref(options.ButtonLabel)).
		SetFilename(strDeref(options.DefaultPath))

	for _, f := range options.Filters {
		dlg = dlg.AddFilter(f.Name, joinExtensions(f.Extensions))
	}
	path, err := dlg.PromptForSingleSelection()
	if err != nil || path == "" {
		return contract.SaveDialogResult{Canceled: true}, nil
	}
	return contract.SaveDialogResult{Canceled: false, FilePath: &path}, nil
}

// ============================================================
// WindowState shared state
// ============================================================

type windowStatePayload struct {
	Maximized bool `json:"maximized"`
	Minimized bool `json:"minimized"`
}

func (s *Service) GetWindowState(ctx context.Context) (*bridge.SharedState, error) {
	w, err := mustWindow(ctx)
	if err != nil {
		return nil, err
	}
	id := fmt.Sprintf("window://%d", w.ID())

	// Initial state intentionally `false` for both flags: Wails v3
	// alpha's `IsMaximised()` / `IsMinimised()` return
	// platform-dependent garbage for frameless windows until the
	// user toggles, and we don't persist either bit to disk
	// (see internal/window/tracker.go for the rationale). The
	// renderer's `Maximize()` bridge call flips the tracked bit
	// itself, which keeps the titlebar glyph correct during a
	// session.
	payload := &windowStatePayload{Maximized: false, Minimized: false}

	s.mu.Lock()
	s.tracked[w.ID()] = payload
	s.mu.Unlock()

	state := s.states.Register(bridge.StateOpts{
		ID:        id,
		StateName: "WindowState",
		Payload:   payload,
		Mutators: map[string]bridge.Mutator{
			"windowMaximized": func(p any) {
				if v, ok := p.(bool); ok {
					payload.Maximized = v
				}
			},
			"windowMinimized": func(p any) {
				if v, ok := p.(bool); ok {
					payload.Minimized = v
				}
			},
		},
	})

	s.attachListenersOnce(w, id, payload)
	return state, nil
}

func (s *Service) attachListenersOnce(w *application.WebviewWindow, id string, payload *windowStatePayload) {
	s.mu.Lock()
	if s.attached[w.ID()] {
		s.mu.Unlock()
		return
	}
	s.attached[w.ID()] = true
	s.mu.Unlock()

	push := func(field string, value bool) {
		switch field {
		case "windowMaximized":
			payload.Maximized = value
		case "windowMinimized":
			payload.Minimized = value
		}
		s.states.Push(id, field, value)
	}

	w.OnWindowEvent(events.Common.WindowMaximise, func(_ *application.WindowEvent) {
		push("windowMaximized", true)
	})
	w.OnWindowEvent(events.Common.WindowUnMaximise, func(_ *application.WindowEvent) {
		push("windowMaximized", false)
	})
	// NOTE: `WindowFullscreen` / `WindowUnFullscreen` are intentionally
	// NOT routed into `windowMaximized`. They fire when the *web
	// content* enters fullscreen (e.g. an HTML5 video calling
	// `requestFullscreen()`), not when the OS window is maximized
	// — the previous code conflated the two and flipped the
	// renderer's state to "maximized" the moment any video element
	// went fullscreen.
	w.OnWindowEvent(events.Common.WindowMinimise, func(_ *application.WindowEvent) {
		push("windowMinimized", true)
	})
	w.OnWindowEvent(events.Common.WindowRestore, func(_ *application.WindowEvent) {
		push("windowMinimized", false)
	})
	w.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		s.mu.Lock()
		delete(s.attached, w.ID())
		delete(s.tracked, w.ID())
		s.mu.Unlock()
	})
}

// ============================================================
// Helpers
// ============================================================

func strDeref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func joinExtensions(exts []string) string {
	out := ""
	for i, e := range exts {
		if i > 0 {
			out += ";"
		}
		out += "*." + e
	}
	return out
}
