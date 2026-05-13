// Package instanceshaderpacks implements
// contract.InstanceShaderPacksService — files under
// `<instance>/shaderpacks/`. Shader packs have no loader-defined
// metadata file, so each entry surfaces only `name` + `path` + size.
package instanceshaderpacks

import (
	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/services/instancedomain"
)

// Service implements contract.InstanceShaderPacksService.
type Service struct {
	*instancedomain.Service
}

// New constructs an InstanceShaderPacksService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{
		Service: instancedomain.New(h, sm, "shaderpacks", "instance-shaderpacks", nil),
	}
}

var _ contract.InstanceShaderPacksService = (*Service)(nil)
