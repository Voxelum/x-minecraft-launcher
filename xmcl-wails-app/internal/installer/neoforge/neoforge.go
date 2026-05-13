// Package neoforge installs NeoForge / NeoForged versions. The
// installer-jar layout is identical to Forge's so the heavy lifting
// (extraction + post-processing) is shared via the `forgepack` and
// `profile` packages.
//
// NeoForge ships under two distinct Maven artifact names:
//
//   - `net.neoforged:forge:<v>`     — the legacy 47.x line (built
//     for Minecraft 1.20.1).
//   - `net.neoforged:neoforge:<v>`  — every release from 1.20.2
//     onwards.
//
// The version-string heuristic in `Install` picks the right artifact;
// callers only have to supply the bare version string the renderer's
// metadata service surfaced.
package neoforge

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/installer/forgepack"
	"github.com/voxelum/xmcl/wails/internal/installer/profile"
	"github.com/voxelum/xmcl/wails/internal/network"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// DefaultMavenURL is NeoForge's official Maven repository.
const DefaultMavenURL = "https://maven.neoforged.net/releases"

// Options configures one NeoForge install.
type Options struct {
	MinecraftDir string
	// MinecraftVersion is the vanilla version NeoForge layers on top.
	MinecraftVersion string
	// LoaderVersion is the bare NeoForge version (e.g. "20.4.237" or
	// "47.1.99"). The artifact name (`forge` vs `neoforge`) is
	// inferred from the prefix.
	LoaderVersion string
	Side          string
	JavaBin       string
	InheritsFrom  string
	Mirror        network.MirrorPreference
	Parallelism   int
	Progress      func(stage string, completed, total int)
}

// Installer is a re-usable handle.
type Installer struct {
	client *network.Client
}

// New constructs an Installer.
func New(client *network.Client) *Installer {
	if client == nil {
		panic("neoforge: nil client")
	}
	return &Installer{client: client}
}

// Install runs the full NeoForge pipeline. Returns the installed
// version id.
func (in *Installer) Install(ctx context.Context, opts Options) (string, error) {
	if opts.MinecraftDir == "" {
		return "", errors.New("neoforge.Install: MinecraftDir required")
	}
	if opts.MinecraftVersion == "" {
		return "", errors.New("neoforge.Install: MinecraftVersion required")
	}
	if opts.LoaderVersion == "" {
		return "", errors.New("neoforge.Install: LoaderVersion required")
	}
	side := opts.Side
	if side == "" {
		side = "client"
	}
	if opts.JavaBin == "" {
		return "", errors.New("neoforge.Install: JavaBin required for post-processors")
	}

	mc := core.NewMinecraftFolder(opts.MinecraftDir)

	artifact, version := pickArtifact(opts.MinecraftVersion, opts.LoaderVersion)
	mavenPath := forgepack.JarMavenPath("net.neoforged", artifact, version, "installer", "jar")

	src := forgepack.JarSource{
		MavenPath:  mavenPath,
		MavenCoord: "net.neoforged:" + artifact + ":" + version,
		URLs:       opts.Mirror.NeoForgeMavenURLs(mavenPath),
	}

	in.report(opts.Progress, "forge.installer", 0, 1)
	if _, err := forgepack.Download(ctx, in.client, mc, src); err != nil {
		return "", fmt.Errorf("neoforge: download installer: %w", err)
	}
	in.report(opts.Progress, "forge.installer", 1, 1)

	inherits := opts.InheritsFrom
	if inherits == "" {
		inherits = opts.MinecraftVersion
	}
	res, err := forgepack.Unpack(ctx, in.client, forgepack.UnpackOptions{
		MinecraftDir: opts.MinecraftDir,
		JarSource:    src,
		InheritsFrom: inherits,
	})
	if err != nil {
		return "", fmt.Errorf("neoforge: unpack installer: %w", err)
	}

	in.report(opts.Progress, "libraries", 0, len(res.Profile.Libraries))
	if err := profile.InstallLibraries(ctx, in.client, mc, res.Profile.Libraries, opts.Parallelism, opts.Mirror); err != nil {
		return "", fmt.Errorf("neoforge: install libraries: %w", err)
	}
	in.report(opts.Progress, "libraries", len(res.Profile.Libraries), len(res.Profile.Libraries))

	procs := profile.Resolve(side, res.Profile, mc)
	if err := profile.Run(ctx, mc, opts.JavaBin, procs, opts.Progress); err != nil {
		return "", fmt.Errorf("neoforge: post-process: %w", err)
	}

	return res.VersionID, nil
}

func (in *Installer) report(cb func(string, int, int), stage string, completed, total int) {
	if cb != nil {
		cb(stage, completed, total)
	}
}

// pickArtifact returns (artifact-name, full-version-string). Mirrors
// the heuristic in `InstallService.installNeoForged` from the TS
// reference: only the legacy 47.x line publishes under `forge`; every
// modern release uses `neoforge`.
func pickArtifact(mcVersion, loaderVersion string) (string, string) {
	isLegacy := strings.HasPrefix(loaderVersion, "47.") || strings.HasPrefix(loaderVersion, "1.20.1-47.")
	if isLegacy {
		v := loaderVersion
		if strings.HasPrefix(v, "47.") {
			v = mcVersion + "-" + loaderVersion
		}
		return "forge", v
	}
	return "neoforge", loaderVersion
}
