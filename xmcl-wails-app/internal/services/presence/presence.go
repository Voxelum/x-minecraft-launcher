// Package presence implements contract.PresenceService.
//
// Wraps github.com/hugolgst/rich-go to drive Discord Rich Presence.
// Connection is lazy: we only call client.Login on the first SetActivity
// call (and only when settings.discordPresence is enabled). When a
// Minecraft process is running, presence updates are skipped to mirror
// the upstream behaviour in xmcl-runtime/presence/PresenceService.ts.
package presence

import (
	"context"
	"sync"
	"time"

	rich "github.com/hugolgst/rich-go/client"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// discordClientID is the application id registered for XMCL.
// Mirrors xmcl-runtime/presence/PresenceService.ts.
const discordClientID = "1075044884400054363"

// Service implements contract.PresenceService.
type Service struct {
	contract.PresenceServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu        sync.Mutex
	connected bool
	disabled  bool // once Login fails, stay quiet for the session
}

// New constructs the service.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.PresenceService = (*Service)(nil)

// SetActivity updates the renderer-supplied activity string.
// No-ops when:
//   - The user disabled discordPresence (settings).
//   - We failed to connect to Discord earlier this session.
//   - We don't have a way to read settings yet — the host registry is
//     populated lazily so we degrade gracefully.
func (s *Service) SetActivity(_ context.Context, activity string) error {
	if !s.shouldRun() {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.disabled {
		return nil
	}
	if !s.connected {
		if err := rich.Login(discordClientID); err != nil {
			s.host.Logger.Warn("presence: failed to connect to Discord; disabling for session",
				"err", err)
			s.disabled = true
			return nil
		}
		s.connected = true
	}
	now := time.Now()
	if err := rich.SetActivity(rich.Activity{
		Details:    activity,
		LargeImage: "dark_512",
		Timestamps: &rich.Timestamps{Start: &now},
	}); err != nil {
		s.host.Logger.Warn("presence: SetActivity failed", "err", err)
	}
	return nil
}

// Close releases the Discord connection on shutdown.
func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.connected {
		rich.Logout()
		s.connected = false
	}
}

// shouldRun checks the persisted setting via the host registry.
// Defaults to "enabled" when settings haven't been loaded yet so the
// renderer's first prompt still works.
func (s *Service) shouldRun() bool {
	store, ok := host.Get[*host.SettingsStore[contract.Settings]](s.host.Registry)
	if !ok || store == nil {
		return true
	}
	return store.Get().DiscordPresence
}
