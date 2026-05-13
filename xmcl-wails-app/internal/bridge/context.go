package bridge

import (
	"context"
	"encoding/json"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// CallContext carries per-IPC information available to a service method.
type CallContext struct {
	bridge     *Bridge
	sender     *application.WebviewWindow
	serviceKey string
	method     string
	ctx        context.Context
}

func newCallContext(b *Bridge, ctx context.Context, sender *application.WebviewWindow, key, method string) *CallContext {
	if ctx == nil {
		ctx = context.Background()
	}
	return &CallContext{bridge: b, sender: sender, serviceKey: key, method: method, ctx: ctx}
}

// Sender returns the calling renderer window, or nil if the call did not
// originate from a known window context (e.g. internal call).
func (c *CallContext) Sender() *application.WebviewWindow { return c.sender }

// Bridge returns the owning bridge.
func (c *CallContext) Bridge() *Bridge { return c.bridge }

// States returns the shared state manager.
func (c *CallContext) States() *StateManager { return c.bridge.states }

// AsContext exposes the underlying request context so service methods can
// honour cancellation propagated from the renderer side.
func (c *CallContext) AsContext() context.Context { return c.ctx }

// ServiceKey returns the service key the call was dispatched against.
func (c *CallContext) ServiceKey() string { return c.serviceKey }

// Method returns the method name the call was dispatched against.
func (c *CallContext) Method() string { return c.method }

// SerializeState turns a SharedState into the renderer-ready snapshot map
// AND registers the calling window as a client of that state. Generated
// dispatchers call this for any service method whose return type is a
// SharedState pointer; without it the renderer cannot reconstruct the
// state object nor receive subsequent commit broadcasts.
func (c *CallContext) SerializeState(s *SharedState) (map[string]any, error) {
	if s == nil {
		return nil, nil
	}
	snap, err := c.bridge.states.Serialize(s.ID, c.sender)
	if err == nil && c.bridge.host != nil && c.bridge.host.Logger != nil {
		raw, _ := json.Marshal(snap)
		c.bridge.host.Logger.Debug("bridge.serializeState",
			"service", c.serviceKey, "method", c.method,
			"stateID", s.ID, "stateName", s.StateName,
			"json", string(raw))
	}
	return snap, err
}

// senderFromContext extracts the originating WebviewWindow from a Wails
// service-call context. Returns nil if no window is associated.
//
// The Wails v3 message processor stows the calling Window into the call
// context under `application.WindowKey` (see
// `pkg/application/messageprocessor_call.go`).
func senderFromContext(ctx context.Context) *application.WebviewWindow {
	return SenderFromContext(ctx)
}

// SenderFromContext is the public counterpart of senderFromContext. Service
// implementations pull the calling window out of the Go context that the
// generated dispatcher hands them (`ctx context.Context`).
func SenderFromContext(ctx context.Context) *application.WebviewWindow {
	if ctx == nil {
		return nil
	}
	raw := ctx.Value(application.WindowKey)
	if raw == nil {
		return nil
	}
	if w, ok := raw.(*application.WebviewWindow); ok {
		return w
	}
	return nil
}
