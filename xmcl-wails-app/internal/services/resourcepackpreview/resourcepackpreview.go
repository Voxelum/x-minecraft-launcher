// Package resourcepackpreview implements contract.ResourcePackPreviewService.
//
// Scaffold: the embedded NotImplemented stub provides default behaviour
// for every method on the contract. Override individual methods on
// *Service as the underlying subsystem lands during the G3+ phases.
package resourcepackpreview

import (
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.ResourcePackPreviewService.
type Service struct {
	contract.ResourcePackPreviewServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager
}

// New constructs a ResourcePackPreviewService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

// Compile-time assertion that we implement the generated contract.
var _ contract.ResourcePackPreviewService = (*Service)(nil)
