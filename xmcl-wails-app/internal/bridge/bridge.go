// Package bridge implements the Wails-bound surface that the renderer
// talks to. The single bound `Bridge` service mirrors the legacy
// Electron preload `serviceChannels` wire format so the existing
// `xmcl-keystone-ui` code can connect without changes.
package bridge

import (
	"context"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/voxelum/xmcl/wails/internal/host"
)

// Bridge is the single Wails-bound service that fronts every renderer
// IPC call. The renderer talks to it as if it were the Electron preload
// `serviceChannels`.
type Bridge struct {
	host     *host.Host
	services *Registry
	states   *StateManager

	mu  sync.RWMutex
	app *application.App
}

// New constructs an empty Bridge. Services are registered via Register
// before AttachApp is called.
func New(h *host.Host) *Bridge {
	b := &Bridge{host: h}
	b.states = NewStateManager(b)
	b.services = NewRegistry()
	return b
}

// Register adds a service to the dispatch registry.
func (b *Bridge) Register(key string, svc Service) {
	b.services.Register(key, svc)
}

// States returns the SharedState manager so services can register state.
func (b *Bridge) States() *StateManager { return b.states }

// AttachApp wires the Wails application reference so the bridge can emit
// events to the renderer. Must be called before Run().
func (b *Bridge) AttachApp(app *application.App) {
	b.mu.Lock()
	b.app = app
	b.mu.Unlock()
}

// ============================================================
// Wails-bound methods (called from the renderer over IPC)
// ============================================================

// Invoke dispatches a service call to the registered service. Returns
// either `{ result }` or `{ error }` to mirror the existing wire format.
func (b *Bridge) Invoke(ctx context.Context, serviceKey string, method string, args []any) map[string]any {
	cctx := newCallContext(b, ctx, senderFromContext(ctx), serviceKey, method)

	if b.host != nil && b.host.Logger != nil {
		b.host.Logger.Debug("bridge.invoke", "service", serviceKey, "method", method, "argc", len(args))
	}

	result, err := b.services.Call(cctx, serviceKey, method, args)
	if err != nil {
		if b.host != nil && b.host.Logger != nil {
			b.host.Logger.Warn("bridge.invoke error", "service", serviceKey, "method", method, "err", err)
		}
		return map[string]any{"error": serializeError(err)}
	}
	if b.host != nil && b.host.Logger != nil {
		b.host.Logger.Debug("bridge.invoke ok", "service", serviceKey, "method", method, "resultType", fmt.Sprintf("%T", result))
	}
	return map[string]any{"result": result}
}

// Commit forwards a renderer-driven mutation onto a SharedState.
func (b *Bridge) Commit(stateID string, methodName string, args []any) string {
	if !b.states.Commit(stateID, methodName, args) {
		return "NOT_STATE_SERVICE"
	}
	return ""
}

// Unref is called when the renderer GC'd a SharedState reference.
func (b *Bridge) Unref(ctx context.Context, stateID string) string {
	if !b.states.Untrack(stateID, senderFromContext(ctx)) {
		return "NOT_STATE_SERVICE"
	}
	return ""
}

// Revalidate asks the owner of a state to re-fetch its data.
func (b *Bridge) Revalidate(stateID string, args []any) {
	b.states.Revalidate(stateID, args)
}

// ============================================================
// Internal helpers
// ============================================================

func (b *Bridge) emit(name string, payload any) {
	b.mu.RLock()
	app := b.app
	b.mu.RUnlock()
	if app == nil {
		return
	}
	app.Event.Emit(name, payload)
}

// EmitServiceEvent broadcasts a typed service event to every renderer.
// Generated `<Service>Events` helpers call this; user code rarely needs
// to call it directly.
func (b *Bridge) EmitServiceEvent(service, event string, args []any) {
	b.emit("service-event", map[string]any{
		"service": service,
		"event":   event,
		"args":    args,
	})
}

func serializeError(err error) map[string]any {
	return map[string]any{
		"errorMessage": err.Error(),
		"name":         fmt.Sprintf("%T", err),
	}
}
