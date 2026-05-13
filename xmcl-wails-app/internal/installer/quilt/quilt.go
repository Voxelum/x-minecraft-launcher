// Package quilt installs a QuiltMC loader version. The Quilt meta
// service mirrors Fabric's `v2` endpoint at `v3` paths and returns
// the same Mojang-style version JSON shape, so this implementation is
// near-identical to the fabric installer.
package quilt

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

// DefaultMetaURL is the Quilt meta endpoint.
const DefaultMetaURL = "https://meta.quiltmc.org"

// Options configures one Quilt install. Mirrors `installQuiltVersion`
// from the TS reference.
type Options struct {
	MinecraftDir     string
	MinecraftVersion string
	LoaderVersion    string
	Side             string
	InheritsFrom     string
	VersionID        string
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
		panic("quilt: nil client")
	}
	return &Installer{client: client}
}

// Install fetches the Quilt profile JSON and writes it to disk.
// Returns the installed version id.
func (in *Installer) Install(ctx context.Context, opts Options) (string, error) {
	if opts.MinecraftDir == "" {
		return "", errors.New("quilt.Install: MinecraftDir required")
	}
	if opts.MinecraftVersion == "" {
		return "", errors.New("quilt.Install: MinecraftVersion required")
	}
	if opts.LoaderVersion == "" {
		return "", errors.New("quilt.Install: LoaderVersion required")
	}
	side := opts.Side
	if side == "" {
		side = "client"
	}

	// e.g. /v3/versions/loader/1.20.4/0.20.0-beta.7/profile/json
	metaPath := fmt.Sprintf("/v3/versions/loader/%s/%s/%s/json", opts.MinecraftVersion, opts.LoaderVersion, profileSegment(side))
	urls := opts.Mirror.QuiltMetaURLs(metaPath)

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
		return "", fmt.Errorf("quilt: fetch profile: %w", lastErr)
	}
	if raw == nil {
		return "", errors.New("quilt.Install: empty meta response")
	}

	inherits := opts.InheritsFrom
	if inherits == "" {
		inherits = opts.MinecraftVersion
	}
	versionID := opts.VersionID
	if versionID == "" {
		versionID = inherits + "-quilt" + opts.LoaderVersion
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

func profileSegment(side string) string {
	if side == "server" {
		return "server"
	}
	return "profile"
}
