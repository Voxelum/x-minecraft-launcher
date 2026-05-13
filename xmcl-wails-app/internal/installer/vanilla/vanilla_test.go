package vanilla

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/voxelum/xmcl/wails/internal/installer/manifest"
	"github.com/voxelum/xmcl/wails/internal/network"
	"github.com/voxelum/xmcl/wails/internal/parsers/core"
)

// TestInstall_VanillaSmoke runs a full json+jar+libs install against
// Mojang's CDN. Skipped unless XMCL_E2E_INSTALL=1 to keep the default
// `go test ./...` offline-friendly. Set XMCL_E2E_VERSION to override
// the version id (default: 1.20.4 — small + classic + no NeoForge
// quirks).
func TestInstall_VanillaSmoke(t *testing.T) {
	if os.Getenv("XMCL_E2E_INSTALL") == "" {
		t.Skip("set XMCL_E2E_INSTALL=1 to enable network-bound install smoke")
	}
	versionID := os.Getenv("XMCL_E2E_VERSION")
	if versionID == "" {
		versionID = "1.20.4"
	}

	root := t.TempDir()
	client := network.New(network.Options{Timeout: 60 * time.Second})
	fetcher := manifest.NewFetcher(client, manifest.Options{
		CachePath: filepath.Join(root, "cache", "version_manifest.json"),
	})
	in := New(client, fetcher)

	stages := map[string]int{}
	resolved, err := in.Install(context.Background(), Options{
		VersionID:    versionID,
		MinecraftDir: root,
		SkipAssets:   true, // assets are massive; jars + libs is enough to verify wiring
		Progress: func(s Stage) {
			stages[s.Name] = s.Total
			t.Logf("stage %q (total=%d)", s.Name, s.Total)
		},
	})
	if err != nil {
		t.Fatalf("Install: %v", err)
	}
	if resolved.MinecraftVersion != versionID {
		t.Errorf("resolved.MinecraftVersion = %q, want %q", resolved.MinecraftVersion, versionID)
	}
	mc := core.NewMinecraftFolder(root)
	if _, err := os.Stat(mc.VersionJar(versionID, "")); err != nil {
		t.Errorf("version jar missing after install: %v", err)
	}
	if _, err := os.Stat(mc.VersionJSON(versionID)); err != nil {
		t.Errorf("version json missing after install: %v", err)
	}
	if stages["libraries"] < 1 {
		t.Errorf("expected libraries stage, got %+v", stages)
	}
}
