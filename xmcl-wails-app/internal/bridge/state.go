package bridge

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Mutator applies a single mutation to a state's underlying payload.
type Mutator func(payload any)

// Revalidator re-fetches the canonical state contents on demand.
type Revalidator func(args []any) error

// SharedState is the Go counterpart of the renderer-side SharedState<T>.
// Each instance is keyed by a stable ID and is broadcast to every tracking
// client window via Bridge.emit("commit", …).
type SharedState struct {
	ID        string
	StateName string

	payload    any
	mutators   map[string]Mutator
	revalidate Revalidator
	dispose    func()

	mu      sync.RWMutex
	clients map[*application.WebviewWindow]struct{}
}

// Mutate applies the named mutation. Returns true if the mutator existed.
func (s *SharedState) Mutate(method string, payload any) bool {
	fn, ok := s.mutators[method]
	if !ok {
		return false
	}
	fn(payload)
	return true
}

// Snapshot returns a JSON-marshalable map carrying the metadata fields the
// renderer-side state factory expects (`id`, `__state__`, plus all payload
// fields).
func (s *SharedState) Snapshot() (map[string]any, error) {
	raw, err := json.Marshal(s.payload)
	if err != nil {
		return nil, err
	}
	obj := map[string]any{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, err
	}
	obj["id"] = s.ID
	obj["__state__"] = s.StateName
	return obj, nil
}

// StateManager tracks every live SharedState and routes commit/unref/revalidate.
type StateManager struct {
	bridge *Bridge

	mu     sync.RWMutex
	states map[string]*SharedState
}

// NewStateManager constructs an empty manager bound to the given bridge.
func NewStateManager(b *Bridge) *StateManager {
	return &StateManager{
		bridge: b,
		states: map[string]*SharedState{},
	}
}

// Bridge returns the owning bridge so service implementations can
// reach `EmitServiceEvent` (used by generated `<Service>Events`
// broadcasters) without taking a second constructor parameter.
func (m *StateManager) Bridge() *Bridge { return m.bridge }

// StateOpts is the parameter bag for StateManager.Register.
type StateOpts struct {
	ID         string
	StateName  string
	Payload    any
	Mutators   map[string]Mutator
	Revalidate Revalidator
	Dispose    func()
}

// Register inserts a state, returning the existing instance if the ID
// already exists (idempotent).
func (m *StateManager) Register(opts StateOpts) *SharedState {
	m.mu.Lock()
	defer m.mu.Unlock()
	if existing, ok := m.states[opts.ID]; ok {
		return existing
	}
	s := &SharedState{
		ID:         opts.ID,
		StateName:  opts.StateName,
		payload:    opts.Payload,
		mutators:   opts.Mutators,
		revalidate: opts.Revalidate,
		dispose:    opts.Dispose,
		clients:    map[*application.WebviewWindow]struct{}{},
	}
	m.states[opts.ID] = s
	return s
}

// Track adds a client window to a state's broadcast set.
func (m *StateManager) Track(stateID string, win *application.WebviewWindow) {
	m.mu.RLock()
	s := m.states[stateID]
	m.mu.RUnlock()
	if s == nil || win == nil {
		return
	}
	s.mu.Lock()
	s.clients[win] = struct{}{}
	s.mu.Unlock()
}

// Untrack removes a client window. When the last client leaves, the state
// is disposed. Returns false if the state was unknown.
func (m *StateManager) Untrack(stateID string, win *application.WebviewWindow) bool {
	m.mu.RLock()
	s := m.states[stateID]
	m.mu.RUnlock()
	if s == nil {
		return false
	}
	s.mu.Lock()
	delete(s.clients, win)
	last := len(s.clients) == 0
	s.mu.Unlock()

	if last {
		m.dispose(stateID)
	}
	return true
}

func (m *StateManager) dispose(stateID string) {
	m.mu.Lock()
	s, ok := m.states[stateID]
	if !ok {
		m.mu.Unlock()
		return
	}
	delete(m.states, stateID)
	m.mu.Unlock()
	if s.dispose != nil {
		s.dispose()
	}
}

// Commit applies a mutation that originated on the renderer side.
func (m *StateManager) Commit(stateID, method string, args []any) bool {
	m.mu.RLock()
	s := m.states[stateID]
	m.mu.RUnlock()
	if s == nil {
		return false
	}
	var payload any
	if len(args) > 0 {
		payload = args[0]
	}
	return s.Mutate(method, payload)
}

// Revalidate triggers the state's revalidator, if any.
func (m *StateManager) Revalidate(stateID string, args []any) {
	m.mu.RLock()
	s := m.states[stateID]
	m.mu.RUnlock()
	if s == nil || s.revalidate == nil {
		return
	}
	_ = s.revalidate(args)
}

// Push emits a commit event to every tracking client. Services should call
// this after applying a Go-originated mutation so the renderer mirror stays
// in sync.
func (m *StateManager) Push(stateID, mutationType string, payload any) {
	m.bridge.emit("commit", map[string]any{
		"id":      stateID,
		"type":    mutationType,
		"payload": payload,
	})
}

// Serialize prepares a state for transmission and tracks the calling client.
func (m *StateManager) Serialize(stateID string, win *application.WebviewWindow) (map[string]any, error) {
	m.mu.RLock()
	s := m.states[stateID]
	m.mu.RUnlock()
	if s == nil {
		return nil, fmt.Errorf("UnknownState: %s", stateID)
	}
	if win != nil {
		s.mu.Lock()
		s.clients[win] = struct{}{}
		s.mu.Unlock()
	}
	return s.Snapshot()
}
