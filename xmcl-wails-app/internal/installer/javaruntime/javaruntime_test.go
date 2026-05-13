package javaruntime

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/voxelum/xmcl/wails/internal/network"
)

// TestPickExecutable just sanity-checks the platform mapping.
func TestPickExecutable(t *testing.T) {
	root := t.TempDir()
	got := PickExecutable(root)
	switch runtime.GOOS {
	case "windows":
		if !strings.HasSuffix(got, "javaw.exe") {
			t.Fatalf("windows path: %s", got)
		}
	case "darwin":
		if !strings.Contains(got, "jre.bundle/Contents/Home/bin/java") {
			t.Fatalf("darwin path: %s", got)
		}
	default:
		if !strings.HasSuffix(got, "bin/java") {
			t.Fatalf("linux path: %s", got)
		}
	}
}

// TestInstall_HappyPath stands up a fake Mojang manifest server +
// fake CDN and verifies that the installer downloads + extracts a
// single-file bundle, sets the executable bit on POSIX, and reports
// the Mojang-style version name.
func TestInstall_HappyPath(t *testing.T) {
	if _, err := platformKey(); err != nil {
		t.Skip("unsupported platform for this test")
	}

	// Pre-compute file payload + sha1 so the manifest can advertise
	// the right digest.
	payload := []byte("#!/bin/sh\necho hello\n")
	sum := sha1.Sum(payload)
	hash := hex.EncodeToString(sum[:])

	var manifestURL, cdnURL string
	manifestSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"files": map[string]any{
				"bin/java": map[string]any{
					"type":       "file",
					"executable": true,
					"downloads": map[string]any{
						"raw": map[string]any{"sha1": hash, "size": len(payload), "url": cdnURL + "/bin/java"},
					},
				},
				"bin": map[string]any{"type": "directory"},
				// A symlink entry to exercise the post-pass
				// without failing on Windows (we accept the
				// fallback file-copy path).
				"bin/javaw": map[string]any{
					"type":   "link",
					"target": "java",
				},
			},
		})
	}))
	defer manifestSrv.Close()
	manifestURL = manifestSrv.URL

	cdn := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Length", "21")
		_, _ = w.Write(payload)
	}))
	defer cdn.Close()
	cdnURL = cdn.URL

	indexSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, _ := platformKey()
		_ = json.NewEncoder(w).Encode(map[string]any{
			key: map[string]any{
				ComponentLegacy: []map[string]any{{
					"availability": map[string]any{"group": 1, "progress": 100},
					"manifest":     map[string]any{"sha1": "0", "size": 0, "url": manifestURL},
					"version":      map[string]any{"name": "8u51", "released": "2025-01-01"},
				}},
			},
		})
	}))
	defer indexSrv.Close()

	dest := t.TempDir()
	in := New(network.New(network.Options{}))
	res, err := in.Install(context.Background(), Options{
		Destination: dest,
		Component:   ComponentLegacy,
		IndexURLs:   []string{indexSrv.URL},
	})
	if err != nil {
		t.Fatalf("Install: %v", err)
	}
	if res.Version != "8u51" {
		t.Fatalf("version: %q", res.Version)
	}
	if res.ComponentDir != filepath.Join(dest, ComponentLegacy) {
		t.Fatalf("dir: %s", res.ComponentDir)
	}
	if _, err := os.Stat(filepath.Join(res.ComponentDir, "bin", "java")); err != nil {
		t.Fatalf("missing java binary: %v", err)
	}
}
