// Package instanceinstall implements
// contract.InstanceInstallService.
//
// G6 cut: a never-installs-anything implementation. The methods
// surface typed errors so the renderer's modpack-install dialogs
// surface a useful message; the watch state always reports "idle"
// so subscribers don't loop on undefined.
//
// The real implementation depends on:
//
//   - ResourceService (catalog of files we already have).
//   - The download pipeline (`internal/network`).
//   - The modpack-format adapters (CurseForge / Modrinth / MCBBS).
//
// Lands once those pieces ship in G6 follow-ups.
package instanceinstall

import (
	"context"
	"errors"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.InstanceInstallService.
type Service struct {
	contract.InstanceInstallServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	mu     sync.Mutex
	states_ map[string]*bridge.SharedState
}

// New constructs an InstanceInstallService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm, states_: map[string]*bridge.SharedState{}}
}

var _ contract.InstanceInstallService = (*Service)(nil)

func (s *Service) InstallInstanceFiles(_ context.Context, _ any) error {
	return errors.New("InstallInstanceFiles: not implemented (pending ResourceService + modpack adapters)")
}
func (s *Service) PreviewInstanceFiles(_ context.Context, _ any) ([]any, error) {
	return []any{}, nil
}
func (s *Service) ResumeInstanceInstall(_ context.Context, _ string, _ []any) (any, error) {
	return nil, nil
}
func (s *Service) DismissUnresolvedFiles(_ context.Context, _ string) error {
	return nil
}

// WatchInstanceInstall returns an idle SharedState so the renderer's
// modpack-install dialog can observe a sane "no install in progress"
// shape.
func (s *Service) WatchInstanceInstall(_ context.Context, path string) (*bridge.SharedState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if st, ok := s.states_[path]; ok {
		return st, nil
	}
	st := s.states.Register(bridge.StateOpts{
		ID:        "instance-install://" + path,
		StateName: "InstanceInstallStatus",
		Payload: map[string]any{
			"installing":      false,
			"installed":       []any{},
			"unresolved":      []any{},
			"pending":         []any{},
		},
	})
	s.states_[path] = st
	return st, nil
}
