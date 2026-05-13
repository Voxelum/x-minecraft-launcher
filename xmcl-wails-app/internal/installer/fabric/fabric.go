// Package fabric installs a FabricMC loader version. The Fabric meta
// service hands us a fully-formed Minecraft `version.json` for the
// requested (minecraft, loader, side) tuple — we only need to fetch
// it, override the id (so multiple loader versions can coexist on
// the same Minecraft version), and drop it on disk.
//
// No jar download or post-processing is required: Fabric ships
// libraries via standard Maven URLs that the regular library
// installer (vanilla.libraryDownloads) handles transparently the
// next time the version is launched / installed.
package fabric

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/voxelum/xmcl/wails/internal/network"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// DefaultMetaURL is the Fabric meta endpoint. The TS reference
// (`@xmcl/installer/fabric.browser.ts`) hard-codes the same URL.
const DefaultMetaURL = "https://meta.fabricmc.net"

// Options configures one Fabric install. Mirrors `installFabric`
// from the TS reference.
type Options struct {
	// MinecraftDir is the launcher's game-data root.
	MinecraftDir string
	// MinecraftVersion is the vanilla version Fabric layers on top.
	MinecraftVersion string
	// LoaderVersion is the Fabric loader version (e.g. "0.16.5").
	LoaderVersion string
	// Side defaults to "client".
	Side string
	// InheritsFrom overrides the version JSON's `inheritsFrom` field.
	// Defaults to MinecraftVersion.
	InheritsFrom string
	// VersionID overrides the on-disk version id. Defaults to
	// `<inherits>-fabric<loader>`.
	VersionID string
	// Mirror toggles BMCL / mirror fall-back.
	Mirror network.MirrorPreference
}

// Installer wraps the network client used for the meta fetch.
type Installer struct {
	client *network.Client
}

// New constructs an Installer.
func New(client *network.Client) *Installer {
	if client == nil {
		panic("fabric: nil client")
	}
	return &Installer{client: client}
}

// Install fetches the Fabric profile JSON and writes it to disk.
// Returns the installed version id.
func (in *Installer) Install(ctx context.Context, opts Options) (string, error) {
	if opts.MinecraftDir == "" {
		return "", errors.New("fabric.Install: MinecraftDir required")
	}
	if opts.MinecraftVersion == "" {
		return "", errors.New("fabric.Install: MinecraftVersion required")
	}
	if opts.LoaderVersion == "" {
		return "", errors.New("fabric.Install: LoaderVersion required")
	}
	side := opts.Side
	if side == "" {
		side = "client"
	}

	// e.g. /v2/versions/loader/1.20.4/0.16.5/profile/json
	metaPath := fmt.Sprintf("/v2/versions/loader/%s/%s/%s/json", opts.MinecraftVersion, opts.LoaderVersion, profileSegment(side))
	urls := opts.Mirror.FabricMetaURLs(metaPath)

	var (
		raw     map[string]any
		lastErr error
	)
	for _, endpoint := range urls {
		if _, err := in.client.GetJSON(ctx, endpoint, &raw); err != nil {
			lastErr = err
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		return "", fmt.Errorf("fabric: fetch profile: %w", lastErr)
	}
	if raw == nil {
		return "", errors.New("fabric.Install: empty meta response")
	}

	inherits := opts.InheritsFrom
	if inherits == "" {
		inherits = opts.MinecraftVersion
	}
	versionID := opts.VersionID
	if versionID == "" {
		versionID = inherits + "-fabric" + opts.LoaderVersion
	}
	raw["id"] = versionID
	raw["inheritsFrom"] = inherits

	mc := core.NewMinecraftFolder(opts.MinecraftDir)
	dest := mc.VersionJSON(versionID)
	if side == "server" {
		dest = mc.VersionServerJSON(versionID)
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return "", err
	}
	body, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(dest, body, 0o644); err != nil {
		return "", err
	}
	return versionID, nil
}

// profileSegment maps a side to its Fabric meta path segment.
func profileSegment(side string) string {
	if side == "server" {
		return "server"
	}
	return "profile"
}
