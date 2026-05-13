// Package versionmetadata implements contract.VersionMetadataService.
//
// The Mojang version manifest is fetched + cached by
// `internal/installer/manifest`; this service is the renderer-facing
// thin shim that exposes "latest release" and lets the renderer
// override it (e.g. when it received fresher data from a custom
// source like BMCLAPI).
package versionmetadata

import (
	"context"
	"path/filepath"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/installer/manifest"
)

// Service implements contract.VersionMetadataService.
type Service struct {
	contract.VersionMetadataServiceNotImplemented

	host    *host.Host
	fetcher *manifest.Fetcher

	once sync.Once
}

// New constructs a VersionMetadataService. The manifest fetcher is
// constructed lazily on first call so we don't pay the disk-read cost
// for renderers that never ask for version data.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.VersionMetadataService = (*Service)(nil)

// Fetcher exposes the underlying manifest fetcher so other services
// (InstallService, JavaService) can share the cache. Callers must not
// hold the returned pointer past the service's lifetime.
func (s *Service) Fetcher() *manifest.Fetcher {
	s.once.Do(func() {
		s.fetcher = manifest.NewFetcher(s.host.HTTP, manifest.Options{
			CachePath: filepath.Join(s.host.AppDataPath, "manifest", "version_manifest.json"),
			URLs:      s.host.Mirror().VersionManifestURLs(),
		})
	})
	// Re-evaluate the chain on every access so the user can flip
	// `apiSetsPreference` at runtime and the next refresh picks up
	// the new BMCL/Mojang ordering.
	s.fetcher.SetURLs(s.host.Mirror().VersionManifestURLs())
	return s.fetcher
}

// GetLatestMinecraftRelease returns the latest release id from the
// cached/fetched manifest. On network failure we still surface the
// last-known value via Override.
func (s *Service) GetLatestMinecraftRelease(ctx context.Context) (string, error) {
	return s.Fetcher().LatestRelease(ctx)
}

// SetLatestMinecraft lets the renderer overwrite the cached `latest`
// pair (e.g. when it received fresher data from a custom source).
// The full versions list is left untouched.
func (s *Service) SetLatestMinecraft(_ context.Context, release string, snapshot string) error {
	s.Fetcher().Override(release, snapshot)
	return nil
}
