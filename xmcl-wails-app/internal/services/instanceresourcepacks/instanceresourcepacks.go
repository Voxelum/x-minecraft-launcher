// Package instanceresourcepacks implements
// contract.InstanceResourcePacksService — files under
// `<instance>/resourcepacks/`. Per-file metadata comes from
// `pack.mcmeta`.
package instanceresourcepacks

import (
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/services/instancedomain"
)

// Service implements contract.InstanceResourcePacksService.
type Service struct {
	*instancedomain.Service
}

// New constructs an InstanceResourcePacksService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		Service: instancedomain.New(h, sm, "resourcepacks", "instance-resourcepacks", instancedomain.ParseResourcePack),
	}
}

var _ contract.InstanceResourcePacksService = (*Service)(nil)
