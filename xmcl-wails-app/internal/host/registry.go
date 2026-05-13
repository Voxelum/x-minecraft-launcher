package host

import (
	"reflect"
	"sync"
)

// Registry is a typed dependency-injection container. It maps a value's
// concrete type (taken via reflect) to the value itself, so callers can
// pull back a strongly-typed instance with [Get]. Mirrors the role of
// `objectRegistry.ts` from the TS side, just without the generic
// InjectionKey indirection (Go's type system gives us that for free).
type Registry struct {
	mu      sync.RWMutex
	objects map[reflect.Type]any
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{objects: map[reflect.Type]any{}}
}

// Set registers `value` under its own concrete type. Calling Set twice
// for the same type overwrites.
func Set[T any](r *Registry, value T) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.objects[reflect.TypeOf(value)] = value
}

// Get pulls back a previously registered value of type T. Returns the
// zero value and false when nothing of that type is registered.
func Get[T any](r *Registry) (T, bool) {
	var zero T
	r.mu.RLock()
	defer r.mu.RUnlock()
	v, ok := r.objects[reflect.TypeOf(zero)]
	if !ok {
		return zero, false
	}
	return v.(T), true
}

// MustGet panics if the value isn't registered. Use only when the
// caller has previously asserted (e.g. in startup wiring) that the
// dependency is present.
func MustGet[T any](r *Registry) T {
	v, ok := Get[T](r)
	if !ok {
		var zero T
		panic("host.Registry: missing " + reflect.TypeOf(zero).String())
	}
	return v
}
