// Package task implements contract.TaskService.
//
// G3 ships a working empty implementation: `getTasks` returns an empty
// slice (the renderer's poll loop is happy with that), `cancel` and
// `clear` are no-ops. The real task scheduler lands in G5 alongside the
// installer pipeline that produces tasks in the first place.
package task

import (
	"context"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.TaskService.
type Service struct {
	contract.TaskServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager
}

// New constructs a TaskService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.TaskService = (*Service)(nil)

// GetTasks returns the live snapshot. Empty list keeps the renderer's
// poll loop from logging errors; real task tracking arrives with the
// installer integration.
func (s *Service) GetTasks(_ context.Context) ([]any, error) {
	return []any{}, nil
}

// Cancel + Clear are no-ops while there are no real tasks.
func (s *Service) Cancel(_ context.Context, _ string) error { return nil }
func (s *Service) Clear(_ context.Context) error            { return nil }

// Compile-time assertion that we implement the generated contract.
var _ contract.TaskService = (*Service)(nil)
