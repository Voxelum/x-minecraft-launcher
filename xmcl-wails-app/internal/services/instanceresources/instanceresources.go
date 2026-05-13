// Package instanceresources implements
// contract.InstanceResourcesService — the generic-domain version
// the renderer uses when it doesn't care which specific
// resource-pack/shader/mod folder a file lives in. The TS reference
// is identical in surface to InstanceResourcePacksService, but
// scoped to a generic catalog domain. Without a SQLite-backed
// resource catalog (deferred), this implementation just exposes the
// `resources/` subfolder so the surface stays non-error.
package instanceresources

import (
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/services/instancedomain"
)

// Service implements contract.InstanceResourcesService.
type Service struct {
	*instancedomain.Service
}

// New constructs an InstanceResourcesService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		Service: instancedomain.New(h, sm, "resources", "instance-resources", nil),
	}
}

var _ contract.InstanceResourcesService = (*Service)(nil)
