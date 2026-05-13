// Package modpack implements contract.ModpackService.
//
// G6 cut: state-only stub. Modpack export/import requires the
// ResourceService catalog + zip-with-manifest tooling neither of
// which is in this phase. The renderer's modpack browser observes
// the empty `ModpackState` so it shows "no modpacks installed"
// instead of crashing.
package modpack

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/market"
	"github.com/voxelum/xmcl/wails/internal/network"
)

// Service implements contract.ModpackService.
type Service struct {
	contract.ModpackServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	once  sync.Once
	state *bridge.SharedState
}

// New constructs a ModpackService.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

var _ contract.ModpackService = (*Service)(nil)

func (s *Service) WatchModpackFolder(_ context.Context) (*bridge.SharedState, error) {
	s.once.Do(func() {
		payload := &contract.ModpackState{Files: []any{}, Ready: true}
		s.state = contract.RegisterModpackState(s.states, "ModpackService", payload)
	})
	return s.state, nil
}

func (s *Service) ShowModpacksFolder(_ context.Context) error { return nil }
func (s *Service) RemoveModpack(_ context.Context, _ string) error {
	return errors.New("RemoveModpack: not implemented")
}
func (s *Service) ImportModpack(_ context.Context, _ string, _ string, _ any) (map[string]any, error) {
	return nil, errors.New("ImportModpack: not implemented (pending ResourceService + modpack adapters)")
}
func (s *Service) OpenModpack(_ context.Context, _ string) (*bridge.SharedState, error) {
	return nil, errors.New("OpenModpack: not implemented")
}
func (s *Service) ExportModpack(_ context.Context, _ contract.ExportModpackOptions) error {
	return errors.New("ExportModpack: not implemented")
}
// InstallModapckFromMarket downloads a Modrinth/CurseForge modpack
// archive into `<gameData>/modpacks/<filename>`. Notes:
//
//   - The TS reference returns the *manifest* paths the renderer
//     can immediately import; we return the on-disk archive path
//     for now (the import-into-instance dance still needs the
//     modpack-format adapters that haven't been ported).
//   - Renderer payload is `InstallMarketOptions` (no instancePath).
func (s *Service) InstallModapckFromMarket(ctx context.Context, options any) ([]string, error) {
	opts, ok := options.(map[string]any)
	if !ok {
		return nil, errors.New("InstallModapckFromMarket: options must be a JSON object")
	}
	files, err := market.NewResolver(s.host.HTTP, s.host.CurseforgeAPIKey).Resolve(ctx, opts)
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(s.host.MinecraftDataPath, "modpacks")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(files))
	for _, f := range files {
		dst := filepath.Join(dir, f.Filename)
		err := s.host.HTTP.Download(ctx, network.DownloadOptions{
			URLs:         f.URLs,
			Destination:  dst,
			ExpectedSHA1: f.SHA1,
			ExpectedSize: f.Size,
		})
		if err != nil {
			s.host.Logger.Warn("modpack: market install failed", "file", f.Filename, "err", err)
			return out, err
		}
		out = append(out, dst)
	}
	return out, nil
}
