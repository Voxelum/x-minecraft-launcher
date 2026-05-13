// Package apps implements contract.AppsService.
//
// G3 ships an empty installed-apps list; the real PWA-style alt-app
// feature lands in G8 alongside the multi-window plumbing.
package apps

import (
	"context"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.AppsService.
type Service struct {
	contract.AppsServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager
}

// New constructs an AppsService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.AppsService = (*Service)(nil)

// GetInstalledApps returns the list of installed alt-apps. G3 ships
// the empty list; the renderer treats this as "only the built-in
// keystone-ui exists", which is the desired G3 behaviour.
func (s *Service) GetInstalledApps(_ context.Context) ([]contract.InstalledAppManifest, error) {
	return []contract.InstalledAppManifest{}, nil
}

// GetDefaultApp returns the URL of the app the launcher should boot
// into. The empty string tells the renderer to use the built-in
// keystone-ui served at the asset-handler root.
func (s *Service) GetDefaultApp(_ context.Context) (string, error) {
	return "", nil
}

// Compile-time assertion that we implement the generated contract.
var _ contract.AppsService = (*Service)(nil)
