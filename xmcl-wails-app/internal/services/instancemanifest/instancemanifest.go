// Package instancemanifest implements
// contract.InstanceManifestService.
//
// `getInstanceManifest(path, hashes?)` walks the instance directory
// (skipping volatile / generated subfolders like `versions`, `logs`,
// `crash-reports`, `screenshots`, `assets`, `libraries`) and emits
// one entry per file with the requested hashes computed inline. The
// returned shape mirrors the renderer's `InstanceManifest`:
//
//	{
//	  "files": [
//	    { "path": "mods/foo.jar", "size": 12345,
//	      "hashes": { "sha1": "...", "md5": "..." } }
//	  ]
//	}
//
// The Game-Server-Manifest variant scopes the walk to `<path>/server/`.
package instancemanifest

import (
	"context"
	"crypto/md5" //nolint:gosec // md5 is part of the upstream manifest schema
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"hash"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.InstanceManifestService.
type Service struct {
	contract.InstanceManifestServiceNotImplemented

	host *host.Host
}

// New constructs an InstanceManifestService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.InstanceManifestService = (*Service)(nil)

// excluded directories — these are launcher state, not user content,
// so the manifest never carries them.
var excludedDirs = map[string]bool{
	"versions":      true,
	"logs":          true,
	"crash-reports": true,
	"screenshots":   true,
	"assets":        true,
	"libraries":     true,
	"natives":       true,
}

// GetInstanceManifest builds the manifest for the instance root.
func (s *Service) GetInstanceManifest(_ context.Context, options contract.GetManifestOptions) (any, error) {
	if options.Path == "" {
		return nil, errors.New("GetInstanceManifest: path required")
	}
	files, err := walkAndHash(options.Path, options.Path, options.Hashes, true)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"files": files,
	}, nil
}

// GetInstanceServerManifest builds the manifest for the bundled
// server folder (`<instance>/server`). Used by the renderer's
// dedicated-server export flow.
func (s *Service) GetInstanceServerManifest(_ context.Context, options contract.GetManifestOptions) ([]any, error) {
	if options.Path == "" {
		return nil, errors.New("GetInstanceServerManifest: path required")
	}
	root := filepath.Join(options.Path, "server")
	if _, err := os.Stat(root); err != nil {
		if os.IsNotExist(err) {
			return []any{}, nil
		}
		return nil, err
	}
	return walkAndHash(root, root, options.Hashes, false)
}

// walkAndHash performs the directory walk + per-file hash computation.
// `skipExcluded` is only honoured at the top level (under sub-domain
// folders, every file is in scope).
func walkAndHash(rootForRel, root string, hashes []string, skipExcluded bool) ([]any, error) {
	out := []any{}
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if !skipExcluded || path == root {
				return nil
			}
			rel, _ := filepath.Rel(root, path)
			top := strings.SplitN(filepath.ToSlash(rel), "/", 2)[0]
			if excludedDirs[top] {
				return filepath.SkipDir
			}
			return nil
		}
		// Skip dotfiles + the launcher's own caches.
		name := info.Name()
		if strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".disabled") {
			// Disabled mods are still part of the manifest — just keep
			// them as a sibling. Strip the dotfile heuristic for hidden
			// files only.
		}
		if strings.HasPrefix(name, ".") && name != ".curseforge" {
			return nil
		}
		rel, err := filepath.Rel(rootForRel, path)
		if err != nil {
			return err
		}
		entry := map[string]any{
			"path": filepath.ToSlash(rel),
			"size": info.Size(),
		}
		if len(hashes) > 0 {
			h, err := hashFile(path, hashes)
			if err != nil {
				return err
			}
			entry["hashes"] = h
		}
		out = append(out, entry)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// hashFile computes the requested hashes for `path` in a single read.
func hashFile(path string, algorithms []string) (map[string]string, error) {
	hashers := map[string]hash.Hash{}
	writers := []io.Writer{}
	for _, name := range algorithms {
		switch strings.ToLower(name) {
		case "sha1":
			hashers["sha1"] = sha1.New() //nolint:gosec
		case "md5":
			hashers["md5"] = md5.New() //nolint:gosec
		case "sha256":
			hashers["sha256"] = sha256.New()
		}
	}
	for _, h := range hashers {
		writers = append(writers, h)
	}
	if len(writers) == 0 {
		return map[string]string{}, nil
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	if _, err := io.Copy(io.MultiWriter(writers...), f); err != nil {
		return nil, err
	}
	out := make(map[string]string, len(hashers))
	for name, h := range hashers {
		out[name] = hex.EncodeToString(h.Sum(nil))
	}
	return out, nil
}
