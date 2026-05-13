// Package bootstrap implements contract.BootstrapService.
//
// G3 returns a sensible BootstrapPreset (current data root, host
// locale, and the list of drives discovered on the system) so the
// first-run setup wizard can proceed to defaults instead of erroring.
package bootstrap

import (
	"context"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.BootstrapService.
type Service struct {
	contract.BootstrapServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager
}

// New constructs a BootstrapService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.BootstrapService = (*Service)(nil)

// GetPreset returns the bootstrap defaults (data-root, host locale,
// drive list). The renderer uses this on first-run to populate the
// data-root chooser; the empty drive list is acceptable until G3.5
// adds the platform-specific enumeration.
func (s *Service) GetPreset(_ context.Context) (contract.BootstrapPreset, error) {
	return contract.BootstrapPreset{
		MinecraftPath: s.host.MinecraftDataPath,
		DefaultPath:   s.host.AppDataPath,
		Locale:        "en",
		Drives:        []contract.Drive{},
	}, nil
}

// Compile-time assertion that we implement the generated contract.
var _ contract.BootstrapService = (*Service)(nil)
