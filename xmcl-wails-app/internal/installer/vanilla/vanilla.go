// Package vanilla orchestrates a full Minecraft client installation:
// download the version json, the client jar, every library + native
// classifier, and every asset object referenced by the asset index.
//
// This is the Go equivalent of `@xmcl/installer`'s `installMinecraft` /
// `installLibraries` / `installAssets` trio, collapsed into a single
// pipeline because the renderer never calls them in isolation.

package vanilla

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/voxelum/xmcl/wails/internal/installer/manifest"
	"github.com/voxelum/xmcl/wails/internal/network"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// Installer is a re-usable handle wrapping the network client and the
// version manifest fetcher. Construct once per host.
type Installer struct {
	client   *network.Client
	manifest *manifest.Fetcher
}

// New constructs an Installer.
func New(client *network.Client, m *manifest.Fetcher) *Installer {
	if client == nil {
		panic("vanilla: nil client")
	}
	if m == nil {
		panic("vanilla: nil manifest")
	}
	return &Installer{client: client, manifest: m}
}

// Options configures one installation. The `Side` field defaults to
// "client" — only `client` is fully wired today; bundled-server
// installs land in a follow-up.
type Options struct {
	// VersionID is e.g. "1.20.4".
	VersionID string
	// MinecraftDir is the launcher's game-data root (the directory
	// that contains `versions/`, `libraries/`, `assets/`).
	MinecraftDir string
	// Side picks the jar to download. Default "client".
	Side string
	// Platform selects the native classifier set. Defaults to host.
	Platform *core.Platform
	// SkipAssets disables the asset-index fan-out (useful for fast
	// "json + jar only" installs the launcher uses to resolve
	// loader dependencies).
	SkipAssets bool
	// Parallelism caps concurrent library / asset downloads. Zero ==
	// 8.
	Parallelism int
	// Mirror controls api-set / BMCL fallback. Zero value == no
	// mirror (Mojang only).
	Mirror network.MirrorPreference
	// Progress receives high-level milestones. nil == discarded.
	Progress func(stage Stage)
}

// Stage is a coarse-grained event the renderer's progress dialog
// renders as discrete steps. The asset stage carries a per-file
// counter so the dialog can show a live progress bar.
type Stage struct {
	Name        string // version-json, version-jar, libraries, assets
	Completed   int
	Total       int
	Description string
}

// Install runs the full vanilla pipeline. Returns the resolved
// version (post-install) so callers don't need to re-read disk.
func (in *Installer) Install(ctx context.Context, opts Options) (*core.ResolvedVersion, error) {
	if opts.VersionID == "" {
		return nil, errors.New("vanilla.Install: VersionID required")
	}
	if opts.MinecraftDir == "" {
		return nil, errors.New("vanilla.Install: MinecraftDir required")
	}
	if opts.Side == "" {
		opts.Side = "client"
	}
	if opts.Parallelism <= 0 {
		opts.Parallelism = 8
	}
	platform := opts.Platform
	if platform == nil {
		p := core.CurrentPlatform()
		platform = &p
	}

	mc := core.NewMinecraftFolder(opts.MinecraftDir)

	// Step 1 — version JSON.
	in.report(opts.Progress, Stage{Name: "version-json", Description: opts.VersionID})
	if err := in.installVersionJSON(ctx, mc, opts.VersionID, opts.Mirror); err != nil {
		return nil, fmt.Errorf("install version-json: %w", err)
	}

	// Parse it now so subsequent steps can reuse the resolved tree.
	resolved, err := core.ParseVersion(mc, opts.VersionID, *platform)
	if err != nil {
		return nil, fmt.Errorf("install: parse %s: %w", opts.VersionID, err)
	}

	// Step 2 — client jar.
	in.report(opts.Progress, Stage{Name: "version-jar", Description: opts.VersionID})
	if err := in.installVersionJar(ctx, mc, resolved, opts.Side, opts.Mirror); err != nil {
		return nil, fmt.Errorf("install version-jar: %w", err)
	}

	// Step 3 — libraries.
	libs := libraryDownloads(mc, resolved, opts.Mirror)
	in.report(opts.Progress, Stage{Name: "libraries", Total: len(libs)})
	if err := in.client.DownloadAll(ctx, libs, opts.Parallelism); err != nil {
		return nil, fmt.Errorf("install libraries: %w", err)
	}

	// Step 4 — assets.
	if !opts.SkipAssets && resolved.AssetIndex != nil {
		in.report(opts.Progress, Stage{Name: "asset-index", Description: resolved.AssetIndex.ID})
		assets, err := in.installAssetIndexAndGetObjects(ctx, mc, resolved, opts.Mirror)
		if err != nil {
			return nil, fmt.Errorf("install asset-index: %w", err)
		}
		in.report(opts.Progress, Stage{Name: "assets", Total: len(assets)})
		if err := in.client.DownloadAll(ctx, assets, opts.Parallelism); err != nil {
			return nil, fmt.Errorf("install assets: %w", err)
		}
	}

	return resolved, nil
}

// ============================================================
// Steps
// ============================================================

// installVersionJSON ensures `<versions>/<id>/<id>.json` exists. We
// always go through the manifest so the URL we hit matches the
// canonical Mojang one (sha1-verified when the manifest carries it).
func (in *Installer) installVersionJSON(ctx context.Context, mc core.MinecraftFolder, versionID string, mirror network.MirrorPreference) error {
	dest := mc.VersionJSON(versionID)
	if _, err := os.Stat(dest); err == nil {
		return nil
	}
	man, err := in.manifest.Get(ctx)
	if err != nil {
		return fmt.Errorf("manifest: %w", err)
	}
	entry := man.FindByID(versionID)
	if entry == nil {
		return fmt.Errorf("manifest: %s: %w", versionID, manifest.ErrNoManifest)
	}
	return in.client.Download(ctx, network.DownloadOptions{
		URLs:         mirror.MojangHostURLs(entry.URL),
		Destination:  dest,
		ExpectedSHA1: entry.SHA1, // can be empty for older manifests
	})
}

// installVersionJar downloads `<versions>/<id>/<id>.jar` (client) or
// `<versions>/<id>/<id>-server.jar` (server side). The download URL +
// sha1 come from the resolved version's `downloads.<side>` entry.
func (in *Installer) installVersionJar(ctx context.Context, mc core.MinecraftFolder, v *core.ResolvedVersion, side string, mirror network.MirrorPreference) error {
	if v.Downloads == nil {
		return nil
	}
	entry, ok := v.Downloads[side]
	if !ok || entry == nil {
		return nil
	}
	dest := mc.VersionJar(v.MinecraftVersion, side)
	return in.client.Download(ctx, network.DownloadOptions{
		URLs:         mirror.MojangHostURLs(entry.URL),
		Destination:  dest,
		ExpectedSHA1: entry.SHA1,
		ExpectedSize: entry.Size,
	})
}

// libraryDownloads collects DownloadOptions for every library jar
// the resolved version references. Native classifier jars are
// included so CheckNatives finds them on launch.
func libraryDownloads(mc core.MinecraftFolder, v *core.ResolvedVersion, mirror network.MirrorPreference) []network.DownloadOptions {
	out := make([]network.DownloadOptions, 0, len(v.Libraries))
	for _, lib := range v.Libraries {
		if lib.Download.Path == "" || lib.Download.URL == "" {
			continue
		}
		out = append(out, network.DownloadOptions{
			URLs:         mirror.LibraryURLs(lib.Download.Path, lib.Download.URL),
			Destination:  mc.LibraryByPath(lib.Download.Path),
			ExpectedSHA1: lib.Download.SHA1,
			ExpectedSize: lib.Download.Size,
		})
	}
	return out
}

// installAssetIndexAndGetObjects downloads the assetIndex JSON,
// parses it, and returns DownloadOptions for every object so the
// caller can fan them out.
func (in *Installer) installAssetIndexAndGetObjects(ctx context.Context, mc core.MinecraftFolder, v *core.ResolvedVersion, mirror network.MirrorPreference) ([]network.DownloadOptions, error) {
	indexDest := mc.AssetsIndex(v.AssetIndex.ID)
	if err := in.client.Download(ctx, network.DownloadOptions{
		URLs:         mirror.MojangHostURLs(v.AssetIndex.URL),
		Destination:  indexDest,
		ExpectedSHA1: v.AssetIndex.SHA1,
		ExpectedSize: int64(v.AssetIndex.Size),
	}); err != nil {
		return nil, err
	}

	raw, err := os.ReadFile(indexDest)
	if err != nil {
		return nil, err
	}
	var idx struct {
		Objects map[string]struct {
			Hash string `json:"hash"`
			Size int64  `json:"size"`
		} `json:"objects"`
	}
	if err := json.Unmarshal(raw, &idx); err != nil {
		return nil, fmt.Errorf("parse asset index: %w", err)
	}

	out := make([]network.DownloadOptions, 0, len(idx.Objects))
	for _, obj := range idx.Objects {
		if len(obj.Hash) < 2 {
			continue
		}
		bucket := obj.Hash[:2]
		dest := filepath.Join(mc.Path("assets", "objects", bucket), obj.Hash)
		out = append(out, network.DownloadOptions{
			URLs:         mirror.AssetsURLs(bucket, obj.Hash),
			Destination:  dest,
			ExpectedSHA1: obj.Hash,
			ExpectedSize: obj.Size,
		})
	}
	return out, nil
}

func (in *Installer) report(cb func(Stage), stage Stage) {
	if cb != nil {
		cb(stage)
	}
}
