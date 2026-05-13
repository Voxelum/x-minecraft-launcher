package bridge

import "fmt"

// Service is the single contract every Go-side service implements.
// Generated dispatchers (Phase G1) implement this via [ServiceFunc].
type Service interface {
	Invoke(ctx *CallContext, method string, args []any) (any, error)
}

// ServiceFunc adapts a plain function into a Service. Used by the
// generated contract dispatchers in `internal/contract/`.
type ServiceFunc func(ctx *CallContext, method string, args []any) (any, error)

// Invoke implements Service.
func (f ServiceFunc) Invoke(ctx *CallContext, method string, args []any) (any, error) {
	return f(ctx, method, args)
}

// Registry holds the live services keyed by their TS-side ServiceKey.
type Registry struct {
	services map[string]Service
}

// NewRegistry returns an empty registry.
func NewRegistry() *Registry {
	return &Registry{services: map[string]Service{}}
}

// Register inserts a service under the given key.
func (r *Registry) Register(key string, s Service) {
	r.services[key] = s
}

// Call dispatches a method to the named service.
func (r *Registry) Call(ctx *CallContext, key string, method string, args []any) (any, error) {
	svc, ok := r.services[key]
	if !ok {
		return nil, fmt.Errorf("ServiceNotFoundError: %s", key)
	}
	return svc.Invoke(ctx, method, args)
}
