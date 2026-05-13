// Package forge installs Minecraft Forge versions ≥ 1.13 (the
// post-processor era). Pre-1.13 "legacy" Forge installs are NOT
// supported here — they used a wholly different `universal.zip`
// merge dance that virtually no contemporary user needs.
//
// Pipeline:
//
//  1. Download the installer jar from Forge's Maven.
//  2. Extract `version.json` + `install_profile.json` + embedded
//     `maven/...` libs + `data/...` blobs (delegated to forgepack).
//  3. Download every library the install profile lists.
//  4. Run the post-processors against the supplied Java binary —
//     they patch the vanilla client jar against the LZMA bin patch
//     and produce the final `forge-<v>-client-extra.jar` etc.
package forge

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

// DefaultMavenURL is Forge's official Maven repository.
const DefaultMavenURL = "https://maven.minecraftforge.net"

// Options configures one Forge install.
type Options struct {
	MinecraftDir     string
	MinecraftVersion string
	// LoaderVersion is the bare Forge version (e.g. "49.0.13"), as
	// the renderer carries it. The full Maven coordinate is derived
	// based on the Minecraft version.
	LoaderVersion string
	// Side defaults to "client".
	Side string
	// JavaBin is the absolute path to the JDK used for post-process
	// execution. Required for MC ≥ 1.13.
	JavaBin string
	// InheritsFrom overrides the embedded `inheritsFrom`. Defaults
	// to MinecraftVersion.
	InheritsFrom string
	// Mirror toggles BMCL / mirror fall-back.
	Mirror network.MirrorPreference
	// InstallerSHA1 verifies the installer jar download.
	InstallerSHA1 string
	// InstallerPath overrides the auto-derived installer Maven path
	// (used when the version metadata service supplied a non-default
	// URL).
	InstallerPath string
	// Parallelism caps concurrent library downloads. Zero == 8.
	Parallelism int
	// Progress, if non-nil, receives stage updates.
	Progress func(stage string, completed, total int)
}

// Installer is a re-usable handle.
type Installer struct {
	client *network.Client
}

// New constructs an Installer.
func New(client *network.Client) *Installer {
	if client == nil {
		panic("forge: nil client")
	}
	return &Installer{client: client}
}

// Install runs the full Forge pipeline. Returns the installed
// version id.
func (in *Installer) Install(ctx context.Context, opts Options) (string, error) {
	if opts.MinecraftDir == "" {
		return "", errors.New("forge.Install: MinecraftDir required")
	}
	if opts.MinecraftVersion == "" {
		return "", errors.New("forge.Install: MinecraftVersion required")
	}
	if opts.LoaderVersion == "" {
		return "", errors.New("forge.Install: LoaderVersion required")
	}
	side := opts.Side
	if side == "" {
		side = "client"
	}
	if opts.JavaBin == "" {
		return "", errors.New("forge.Install: JavaBin required for post-processors (MC >= 1.13)")
	}

	mc := core.NewMinecraftFolder(opts.MinecraftDir)

	// Forge's artifact version embeds the Minecraft version unless the
	// caller already passed a fully-qualified one.
	forgeArtifact := forgeArtifactVersion(opts.MinecraftVersion, opts.LoaderVersion)
	mavenPath := opts.InstallerPath
	if mavenPath == "" {
		mavenPath = forgepack.JarMavenPath("net.minecraftforge", "forge", forgeArtifact, "installer", "jar")
	}

	src := forgepack.JarSource{
		MavenPath:  mavenPath,
		MavenCoord: "net.minecraftforge:forge:" + forgeArtifact,
		URLs:       opts.Mirror.ForgeMavenURLs(mavenPath),
		SHA1:       opts.InstallerSHA1,
	}

	in.report(opts.Progress, "forge.installer", 0, 1)
	if _, err := forgepack.Download(ctx, in.client, mc, src); err != nil {
		return "", fmt.Errorf("forge: download installer: %w", err)
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
		return "", fmt.Errorf("forge: unpack installer: %w", err)
	}

	in.report(opts.Progress, "libraries", 0, len(res.Profile.Libraries))
	if err := profile.InstallLibraries(ctx, in.client, mc, res.Profile.Libraries, opts.Parallelism, opts.Mirror); err != nil {
		return "", fmt.Errorf("forge: install libraries: %w", err)
	}
	in.report(opts.Progress, "libraries", len(res.Profile.Libraries), len(res.Profile.Libraries))

	procs := profile.Resolve(side, res.Profile, mc)
	if err := profile.Run(ctx, mc, opts.JavaBin, procs, opts.Progress); err != nil {
		return "", fmt.Errorf("forge: post-process: %w", err)
	}

	return res.VersionID, nil
}

func (in *Installer) report(cb func(string, int, int), stage string, completed, total int) {
	if cb != nil {
		cb(stage, completed, total)
	}
}

// forgeArtifactVersion mirrors the TS reference's logic. Most modern
// Forge versions need `<mc>-<loader>` concatenation; for some legacy
// 1.7-1.8 versions an additional `-<mc>` suffix was historically
// appended. If the caller already supplied a fully-qualified version
// (one starting with the MC version) it's used verbatim.
func forgeArtifactVersion(mcVersion, loaderVersion string) string {
	if strings.HasPrefix(loaderVersion, mcVersion) {
		return loaderVersion
	}
	parts := strings.Split(mcVersion, ".")
	if len(parts) >= 2 {
		minor := parts[1]
		// 1.7.x and 1.8.x Forge versions historically used the triple
		// concatenation. The newer Forge versions used by anyone today
		// use the simpler `<mc>-<loader>` form.
		if minor == "7" || minor == "8" {
			return mcVersion + "-" + loaderVersion + "-" + mcVersion
		}
	}
	return mcVersion + "-" + loaderVersion
}
