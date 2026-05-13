// Package install implements contract.InstallService.
//
// G5 surface: vanilla install end-to-end (json + jar + libraries +
// assets). Loader installs (Forge / Fabric / Quilt / NeoForge /
// OptiFine / LabyMod) are still stubbed — the renderer surfaces a
// "not implemented" error which the per-loader follow-up will fill
// in.
//
// The installer is reused across calls so the in-memory manifest
// cache stays warm. Concurrency tuning is exposed via the renderer's
// existing settings (`maxAPISockets`); we bridge that into the
// downloader's parallelism knob below.
package install

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/installer/fabric"
	"github.com/voxelum/xmcl/wails/internal/installer/forge"
	"github.com/voxelum/xmcl/wails/internal/installer/manifest"
	"github.com/voxelum/xmcl/wails/internal/installer/neoforge"
	"github.com/voxelum/xmcl/wails/internal/installer/quilt"
	"github.com/voxelum/xmcl/wails/internal/installer/vanilla"
	"github.com/voxelum/xmcl/wails/internal/network"
)

// Service implements contract.InstallService.
type Service struct {
	contract.InstallServiceNotImplemented

	host *host.Host

	once     sync.Once
	fetcher  *manifest.Fetcher
	vanilla  *vanilla.Installer
	fabric   *fabric.Installer
	quilt    *quilt.Installer
	forge    *forge.Installer
	neoforge *neoforge.Installer
}

// New constructs an InstallService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

// Compile-time assertion that we implement the generated contract.
var _ contract.InstallService = (*Service)(nil)

func (s *Service) ensure() {
	s.once.Do(func() {
		s.fetcher = manifest.NewFetcher(s.host.HTTP, manifest.Options{
			CachePath: filepath.Join(s.host.AppDataPath, "manifest", "version_manifest.json"),
			URLs:      s.host.Mirror().VersionManifestURLs(),
		})
		s.vanilla = vanilla.New(s.host.HTTP, s.fetcher)
		s.fabric = fabric.New(s.host.HTTP)
		s.quilt = quilt.New(s.host.HTTP)
		s.forge = forge.New(s.host.HTTP)
		s.neoforge = neoforge.New(s.host.HTTP)
	})
	// Re-evaluate the manifest fetch chain on every call so a runtime
	// flip of the user's `apiSetsPreference` takes effect on the next
	// install without a launcher restart.
	s.fetcher.SetURLs(s.host.Mirror().VersionManifestURLs())
}

// ============================================================
// Vanilla install
// ============================================================

// InstallMinecraft runs the full vanilla pipeline (json + jar +
// libraries + assets). The renderer's progress dialog will eventually
// listen on a `install-progress` event we'll wire from the Stage
// callback in a follow-up; today we just block until completion.
func (s *Service) InstallMinecraft(ctx context.Context, options contract.InstallMinecraftOptions) error {
	if options.Meta.Id == "" {
		return errors.New("InstallMinecraft: meta.id required")
	}
	s.ensure()
	side := "client"
	if options.Side != nil {
		side = *options.Side
	}
	_, err := s.vanilla.Install(ctx, vanilla.Options{
		VersionID:    options.Meta.Id,
		MinecraftDir: s.host.MinecraftDataPath,
		Side:         side,
		Mirror:       s.host.Mirror(),
	})
	if err != nil {
		s.host.Logger.Error("InstallMinecraft", "version", options.Meta.Id, "err", err)
		return err
	}
	s.host.Logger.Info("InstallMinecraft", "version", options.Meta.Id, "side", side, "status", "ok")
	return nil
}

// InstallMinecraftJar downloads only the client/server jar for an
// already-installed version (json must exist on disk). Useful when
// the user wants to swap sides without re-fetching everything else.
func (s *Service) InstallMinecraftJar(ctx context.Context, options contract.InstallMinecraftJarOptions) error {
	if options.Version == "" {
		return errors.New("InstallMinecraftJar: version required")
	}
	s.ensure()
	side := "client"
	if options.Side != nil {
		side = *options.Side
	}
	_, err := s.vanilla.Install(ctx, vanilla.Options{
		VersionID:    options.Version,
		MinecraftDir: s.host.MinecraftDataPath,
		Side:         side,
		SkipAssets:   true,
		Mirror:       s.host.Mirror(),
	})
	return err
}

// InstallLibraries downloads any missing library jars for the given
// version. Implementation just runs the vanilla install with
// SkipAssets so libraries get pulled but the asset fan-out doesn't
// run.
func (s *Service) InstallLibraries(ctx context.Context, options contract.InstallLibrariesOptions) error {
	if options.Version == nil || *options.Version == "" {
		return errors.New("InstallLibraries: version required")
	}
	s.ensure()
	_, err := s.vanilla.Install(ctx, vanilla.Options{
		VersionID:    *options.Version,
		MinecraftDir: s.host.MinecraftDataPath,
		SkipAssets:   true,
		Mirror:       s.host.Mirror(),
	})
	return err
}

// InstallAssets fans out the asset-object downloads listed in the
// renderer-supplied `assets` array. Each `Asset` carries a hash and
// size; we only need those plus Mojang's well-known resource server
// URL.
func (s *Service) InstallAssets(ctx context.Context, options contract.InstallAssetsOptions) error {
	if len(options.Assets) == 0 {
		return nil
	}
	s.ensure()
	mirror := s.host.Mirror()
	mc := filepath.Join(s.host.MinecraftDataPath, "assets", "objects")
	items := make([]network.DownloadOptions, 0, len(options.Assets))
	for _, a := range options.Assets {
		if len(a.Hash) < 2 {
			continue
		}
		bucket := a.Hash[:2]
		items = append(items, network.DownloadOptions{
			URLs:         mirror.AssetsURLs(bucket, a.Hash),
			Destination:  filepath.Join(mc, bucket, a.Hash),
			ExpectedSHA1: a.Hash,
			ExpectedSize: int64(a.Size),
		})
	}
	return s.host.HTTP.DownloadAll(ctx, items, 8)
}

// InstallAssetsForVersion is a higher-level wrapper that takes a
// version id (the renderer's options carry it directly). Falls back
// to the manifest-driven vanilla install path which already does the
// asset fan-out.
func (s *Service) InstallAssetsForVersion(ctx context.Context, options contract.InstallAssetsForVersionOptions) error {
	if options.Version == "" {
		return errors.New("InstallAssetsForVersion: version required")
	}
	s.ensure()
	_, err := s.vanilla.Install(ctx, vanilla.Options{
		VersionID:    options.Version,
		MinecraftDir: s.host.MinecraftDataPath,
		Mirror:       s.host.Mirror(),
	})
	return err
}

// InstallDependencies runs the full vanilla pipeline (json + jar +
// libs + assets) for the specified version id.
func (s *Service) InstallDependencies(ctx context.Context, options contract.InstallDependenciesOptions) error {
	if options.Version == "" {
		return errors.New("InstallDependencies: version required")
	}
	s.ensure()
	side := "client"
	if options.Side != nil {
		side = *options.Side
	}
	_, err := s.vanilla.Install(ctx, vanilla.Options{
		VersionID:    options.Version,
		MinecraftDir: s.host.MinecraftDataPath,
		Side:         side,
		Mirror:       s.host.Mirror(),
	})
	return err
}

// Reinstall is a forced full install — equivalent to InstallMinecraft
// except sha1 verification will catch corrupt downloads and re-fetch.
// Force handling is implicit in the downloader's existing checksum
// path (mismatched files are overwritten).
func (s *Service) Reinstall(ctx context.Context, options contract.ReinstallOptions) error {
	if options.Version == "" {
		return errors.New("Reinstall: version required")
	}
	s.ensure()
	_, err := s.vanilla.Install(ctx, vanilla.Options{
		VersionID:    options.Version,
		MinecraftDir: s.host.MinecraftDataPath,
		Mirror:       s.host.Mirror(),
	})
	return err
}

// ============================================================
// Loader installs
// ============================================================

// InstallForge installs a Forge loader version. The full pipeline
// (download installer jar → extract → install libraries → run
// post-processors) lives in `internal/installer/forge`. Java is
// picked from the cached `javas.json`; callers can override via
// options.Java.
func (s *Service) InstallForge(ctx context.Context, options contract.InstallForgeOptions) (string, error) {
	if options.Mcversion == "" || options.Version == "" {
		return "", errors.New("InstallForge: mcversion + version required")
	}
	s.ensure()
	javaBin, err := s.pickJava(options.Java, javaForMC(options.Mcversion))
	if err != nil {
		return "", fmt.Errorf("InstallForge: %w", err)
	}
	opts := forge.Options{
		MinecraftDir:     s.host.MinecraftDataPath,
		MinecraftVersion: options.Mcversion,
		LoaderVersion:    options.Version,
		JavaBin:          javaBin,
		Mirror:           s.host.Mirror(),
	}
	if options.Side != nil {
		opts.Side = *options.Side
	}
	if options.Base != nil {
		opts.InheritsFrom = *options.Base
	}
	if options.Installer != nil {
		if p, ok := options.Installer["path"].(string); ok {
			opts.InstallerPath = p
		}
		if sha, ok := options.Installer["sha1"].(string); ok {
			opts.InstallerSHA1 = sha
		}
	}
	opts.Progress = s.makeProgressEmitter("forge", options.Mcversion+"-"+options.Version)
	versionID, err := s.forge.Install(ctx, opts)
	if err != nil {
		s.host.Logger.Error("InstallForge", "mc", options.Mcversion, "loader", options.Version, "err", err)
		return "", err
	}
	s.host.Logger.Info("InstallForge", "mc", options.Mcversion, "loader", options.Version, "version", versionID)
	return versionID, nil
}

// InstallNeoForged installs a NeoForge / NeoForged loader version.
func (s *Service) InstallNeoForged(ctx context.Context, options contract.InstallNeoForgedOptions) (string, error) {
	if options.Minecraft == "" || options.Version == "" {
		return "", errors.New("InstallNeoForged: minecraft + version required")
	}
	s.ensure()
	javaBin, err := s.pickJava(options.Java, javaForMC(options.Minecraft))
	if err != nil {
		return "", fmt.Errorf("InstallNeoForged: %w", err)
	}
	opts := neoforge.Options{
		MinecraftDir:     s.host.MinecraftDataPath,
		MinecraftVersion: options.Minecraft,
		LoaderVersion:    options.Version,
		JavaBin:          javaBin,
		Mirror:           s.host.Mirror(),
	}
	if options.Side != nil {
		opts.Side = *options.Side
	}
	if options.Base != nil {
		opts.InheritsFrom = *options.Base
	}
	opts.Progress = s.makeProgressEmitter("neoforge", options.Minecraft+"-"+options.Version)
	versionID, err := s.neoforge.Install(ctx, opts)
	if err != nil {
		s.host.Logger.Error("InstallNeoForged", "mc", options.Minecraft, "loader", options.Version, "err", err)
		return "", err
	}
	s.host.Logger.Info("InstallNeoForged", "mc", options.Minecraft, "loader", options.Version, "version", versionID)
	return versionID, nil
}

// InstallFabric installs a Fabric loader version.
func (s *Service) InstallFabric(ctx context.Context, options contract.InstallFabricOptions) (string, error) {
	if options.Minecraft == "" || options.Loader == "" {
		return "", errors.New("InstallFabric: minecraft + loader required")
	}
	s.ensure()
	opts := fabric.Options{
		MinecraftDir:     s.host.MinecraftDataPath,
		MinecraftVersion: options.Minecraft,
		LoaderVersion:    options.Loader,
		Mirror:           s.host.Mirror(),
	}
	if options.Side != nil {
		opts.Side = *options.Side
	}
	if options.Base != nil {
		opts.InheritsFrom = *options.Base
	}
	versionID, err := s.fabric.Install(ctx, opts)
	if err != nil {
		s.host.Logger.Error("InstallFabric", "mc", options.Minecraft, "loader", options.Loader, "err", err)
		return "", err
	}
	s.host.Logger.Info("InstallFabric", "mc", options.Minecraft, "loader", options.Loader, "version", versionID)
	return versionID, nil
}

// InstallQuilt installs a Quilt loader version.
func (s *Service) InstallQuilt(ctx context.Context, options contract.InstallQuiltOptions) (string, error) {
	if options.MinecraftVersion == "" || options.Version == "" {
		return "", errors.New("InstallQuilt: minecraftVersion + version required")
	}
	s.ensure()
	opts := quilt.Options{
		MinecraftDir:     s.host.MinecraftDataPath,
		MinecraftVersion: options.MinecraftVersion,
		LoaderVersion:    options.Version,
		Mirror:           s.host.Mirror(),
	}
	if options.Side != nil {
		opts.Side = *options.Side
	}
	if options.Base != nil {
		opts.InheritsFrom = *options.Base
	}
	versionID, err := s.quilt.Install(ctx, opts)
	if err != nil {
		s.host.Logger.Error("InstallQuilt", "mc", options.MinecraftVersion, "loader", options.Version, "err", err)
		return "", err
	}
	s.host.Logger.Info("InstallQuilt", "mc", options.MinecraftVersion, "loader", options.Version, "version", versionID)
	return versionID, nil
}

// pickJava picks a JDK binary for installer post-processor execution.
// Calls into javapick.go which reads the persisted javas.json.
func (s *Service) pickJava(preferred *string, minMajor int) (string, error) {
	p := ""
	if preferred != nil {
		p = *preferred
	}
	return pickJava(s.host.AppDataPath, p, minMajor)
}

// javaForMC returns the minimum Java major version required for the
// given Minecraft version. Mojang switched to Java 17 at MC 1.18,
// then to Java 21 at MC 1.20.5. Older versions accept Java 8.
func javaForMC(mcVersion string) int {
	switch {
	case mcAtLeast(mcVersion, 1, 20, 5):
		return 21
	case mcAtLeast(mcVersion, 1, 18, 0):
		return 17
	case mcAtLeast(mcVersion, 1, 17, 0):
		return 16
	default:
		return 8
	}
}

// mcAtLeast reports whether `mcVersion` is >= `<major>.<minor>.<patch>`.
// Returns false on any parse failure (treats unknowns as old).
func mcAtLeast(mcVersion string, major, minor, patch int) bool {
	var a, b, c int
	n, _ := fmt.Sscanf(mcVersion, "%d.%d.%d", &a, &b, &c)
	if n < 2 {
		return false
	}
	if a != major {
		return a > major
	}
	if b != minor {
		return b > minor
	}
	return c >= patch
}

// makeProgressEmitter returns a callback installer packages can call
// to surface stage events. We funnel them through the host logger
// for now; a follow-up will route them through the renderer's
// TaskService event channel.
func (s *Service) makeProgressEmitter(loader, label string) func(stage string, completed, total int) {
	return func(stage string, completed, total int) {
		s.host.Logger.Info("install-progress",
			"loader", loader, "label", label,
			"stage", stage, "completed", completed, "total", total)
	}
}

// InstallOptifine installs OptiFine. Stubbed in G5.
func (s *Service) InstallOptifine(_ context.Context, _ contract.InstallOptifineOptions) (string, error) {
	return "", errors.New("InstallOptifine: not implemented")
}

// InstallOptifineAsMod installs OptiFine into an instance's mods/.
// Stubbed in G5.
func (s *Service) InstallOptifineAsMod(_ context.Context, _ contract.InstallOptifineAsModOptions) error {
	return errors.New("InstallOptifineAsMod: not implemented")
}

// InstallLabyModVersion installs the LabyMod loader. Stubbed in G5.
func (s *Service) InstallLabyModVersion(_ context.Context, _ contract.InstallLabyModOptions) (string, error) {
	return "", errors.New("InstallLabyModVersion: not implemented")
}

// InstallByProfile installs from a Forge/NeoForge `installer.json`
// profile descriptor. Stubbed in G5.
func (s *Service) InstallByProfile(_ context.Context, _ contract.InstallProfileOptions) error {
	return errors.New("InstallByProfile: not implemented")
}

// Diagnose inspects an installed version and reports any missing
// pieces. Stubbed in G5; the vanilla installer's sha1-verifying
// downloader already handles the "actually fix things" path.
func (s *Service) Diagnose(_ context.Context, _ contract.DiagnoseOptions) (*contract.InstallIssue, error) {
	return nil, nil
}
