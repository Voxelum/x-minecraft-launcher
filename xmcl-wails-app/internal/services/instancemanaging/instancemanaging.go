// Package instancemanaging implements
// contract.InstanceManagingService.
//
// "Managed" instances are HMCL/Modrinth-style modpack-backed
// instances whose state is tracked separately so the launcher can
// `refresh()` / `update()` them when the upstream changes. Without
// the modpack pipeline (deferred), this service exposes an
// always-empty state and surfaces typed errors for the mutating
// methods so the renderer's settings dialog still renders.
package instancemanaging

import (
	"context"
	"errors"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

const stateID = "InstanceManagingState"

// Service implements contract.InstanceManagingService.
type Service struct {
	contract.InstanceManagingServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	once  sync.Once
	state *bridge.SharedState
}

// New constructs an InstanceManagingService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.InstanceManagingService = (*Service)(nil)

// GetState returns an always-empty managing state. The renderer
// observes this to know whether the active instance is "managed";
// returning empty means "no managed instances".
func (s *Service) GetState(_ context.Context) (*bridge.SharedState, error) {
	s.once.Do(func() {
		s.state = s.states.Register(bridge.StateOpts{
			ID:        stateID,
			StateName: "InstanceManagingState",
			Payload:   map[string]any{"instances": []any{}},
		})
	})
	return s.state, nil
}

// CreateManagedInstance / Refresh / Update — out of scope for G6
// (need the modpack export/import pipeline). Surface typed errors
// so the renderer's "Manage" dialog shows a clear message.
func (s *Service) CreateManagedInstance(_ context.Context, _ contract.CreateManagedInstanceOptions) (string, error) {
	return "", errors.New("CreateManagedInstance: not implemented (modpack pipeline pending)")
}
func (s *Service) Refresh(_ context.Context) error {
	return errors.New("Refresh: not implemented")
}
func (s *Service) Update(_ context.Context) error {
	return errors.New("Update: not implemented")
}
