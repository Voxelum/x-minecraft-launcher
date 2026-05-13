// Package instanceio implements contract.InstanceIOService.
//
// Surface today (G6 cut):
//
//   - GetGameDefaultPath  — returns the OS default game-data path
//     for the requested launcher type (vanilla
//     wired; modrinth / curseforge stubs).
//   - ParseInstanceFiles  — walks an instance/.minecraft folder and
//     emits a flat InstanceFile[] suitable for
//     the renderer's import dialog.
//   - ParseLauncherData /
//     ImportLauncherData /
//     ExportInstanceAsServer — out of scope (third-party launcher
//     data parsers + dedicated-server
//     export).
package instanceio

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.InstanceIOService.
type Service struct {
	contract.InstanceIOServiceNotImplemented

	host *host.Host
}

// New constructs an InstanceIOService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.InstanceIOService = (*Service)(nil)

// GetGameDefaultPath returns the conventional install root for the
// supplied launcher type. Empty string == use the launcher's chosen
// game-data root.
func (s *Service) GetGameDefaultPath(_ context.Context, launcherType string) (string, error) {
	switch launcherType {
	case "", "vanilla":
		return defaultMinecraftDir(), nil
	case "modrinth", "modrinth-instances":
		return defaultModrinthDir(), nil
	case "curseforge":
		return defaultCurseforgeDir(), nil
	}
	return "", nil
}

// ParseInstanceFiles walks `path` and produces a flat list of
// InstanceFile entries. Volatile launcher state is excluded
// (versions/, libraries/, assets/, logs/, crash-reports/). Each entry
// carries the relative path, size, and an SHA-1 hash so the renderer
// can diff against an upstream manifest.
func (s *Service) ParseInstanceFiles(_ context.Context, path string, _ string) ([]any, error) {
	if path == "" {
		return nil, errors.New("ParseInstanceFiles: path required")
	}
	out := []any{}
	excluded := map[string]bool{
		"versions": true, "libraries": true, "assets": true,
		"natives": true, "logs": true, "crash-reports": true,
		"screenshots": true,
	}
	err := filepath.Walk(path, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if p == path {
				return nil
			}
			rel, _ := filepath.Rel(path, p)
			top := strings.SplitN(filepath.ToSlash(rel), "/", 2)[0]
			if excluded[top] {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(info.Name(), ".") {
			return nil
		}
		rel, err := filepath.Rel(path, p)
		if err != nil {
			return err
		}
		hash, _ := sha1OfFile(p)
		entry := map[string]any{
			"path":   filepath.ToSlash(rel),
			"size":   info.Size(),
			"hashes": map[string]string{"sha1": hash},
		}
		out = append(out, entry)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// ParseLauncherData / ImportLauncherData / ExportInstanceAsServer
// stubbed — they need third-party launcher format adapters
// (HMCL/MMC/Modrinth) plus the modpack export pipeline.
func (s *Service) ParseLauncherData(_ context.Context, _ string, _ string) (contract.ThirdPartyLauncherManifest, error) {
	return contract.ThirdPartyLauncherManifest{
		Instances: []map[string]any{},
		Folder:    map[string]any{},
	}, errors.New("ParseLauncherData: not implemented (third-party launcher adapters pending)")
}

func (s *Service) ImportLauncherData(_ context.Context, _ contract.ThirdPartyLauncherManifest) error {
	return errors.New("ImportLauncherData: not implemented")
}

func (s *Service) ExportInstanceAsServer(_ context.Context, _ contract.ExportInstanceAsServerOptions) error {
	return errors.New("ExportInstanceAsServer: not implemented")
}

// ============================================================
// Helpers
// ============================================================

func defaultMinecraftDir() string {
	switch runtime.GOOS {
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, ".minecraft")
		}
	case "darwin":
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, "Library", "Application Support", "minecraft")
		}
	default:
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, ".minecraft")
		}
	}
	return ""
}

func defaultModrinthDir() string {
	switch runtime.GOOS {
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, "ModrinthApp")
		}
	case "darwin":
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, "Library", "Application Support", "ModrinthApp")
		}
	default:
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, ".config", "ModrinthApp")
		}
	}
	return ""
}

func defaultCurseforgeDir() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	if profile := os.Getenv("USERPROFILE"); profile != "" {
		return filepath.Join(profile, "Documents", "curseforge", "minecraft", "Instances")
	}
	return ""
}

func sha1OfFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
