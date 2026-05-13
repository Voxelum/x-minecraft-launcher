// Package theme implements contract.ThemeService.
//
// Persistent theme state lives in `<appDataPath>/theme.json` with the
// referenced media stored under `<appDataPath>/theme-media/`. The
// stored-theme archive folder (`<appDataPath>/themes/`) carries
// `.xtheme` bundles — those are exported/imported through the
// renderer's `useStoredThemes` composable.
//
// G6 implements the bare minimum the home view needs:
//
//   - GetCurrentTheme        — read theme.json
//   - SetCurrentTheme        — atomic-rename write
//   - GetStoredThemes        — list `.xtheme` files
//   - DeleteStoredTheme      — remove an `.xtheme`
//   - AddMedia / RemoveMedia — copy/delete in theme-media/
//
// Heavier flows (export/import .xtheme zip, save-to-store) are still
// stubbed; they're invoked from explicit user actions in the
// renderer and can land later without blocking the main view.
package theme

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.ThemeService.
type Service struct {
	contract.ThemeServiceNotImplemented

	host *host.Host
}

// New constructs a ThemeService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.ThemeService = (*Service)(nil)

// ============================================================
// Theme JSON
// ============================================================

const themeFile = "theme.json"

// GetCurrentTheme reads the active theme JSON; returns nil + nil-err
// when no theme is set so the renderer falls back to its baked-in
// default.
func (s *Service) GetCurrentTheme(_ context.Context) (*contract.ThemeData, error) {
	data, err := os.ReadFile(filepath.Join(s.host.AppDataPath, themeFile))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	var t contract.ThemeData
	if err := json.Unmarshal(data, &t); err != nil {
		s.host.Logger.Warn("theme: parse failed; ignoring stored theme", "err", err)
		return nil, nil
	}
	return &t, nil
}

// SetCurrentTheme writes the active theme JSON via atomic-rename.
func (s *Service) SetCurrentTheme(_ context.Context, data contract.ThemeData) error {
	if err := os.MkdirAll(s.host.AppDataPath, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	target := filepath.Join(s.host.AppDataPath, themeFile)
	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}

// ============================================================
// Media
// ============================================================

const themeMediaDir = "theme-media"
const themeMediaURLPrefix = "http://launcher/theme-media/"

// AddMedia copies `filePath` into `theme-media/` and returns the
// `http://launcher/theme-media/<basename>` URL the renderer uses
// to load it.
func (s *Service) AddMedia(_ context.Context, filePath string) (contract.MediaData, error) {
	src, err := os.ReadFile(filePath)
	if err != nil {
		return contract.MediaData{}, err
	}
	dir := filepath.Join(s.host.AppDataPath, themeMediaDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return contract.MediaData{}, err
	}
	name := filepath.Base(filePath)
	if err := os.WriteFile(filepath.Join(dir, name), src, 0o644); err != nil {
		return contract.MediaData{}, err
	}
	return contract.MediaData{
		Url:      themeMediaURLPrefix + url.PathEscape(name),
		Type:     mediaTypeFromExt(filepath.Ext(name)),
		MimeType: mimeTypeFromExt(filepath.Ext(name)),
	}, nil
}

// RemoveMedia deletes a media file previously added through AddMedia.
func (s *Service) RemoveMedia(_ context.Context, mediaURL string) error {
	if !strings.HasPrefix(mediaURL, themeMediaURLPrefix) {
		return nil
	}
	name, err := url.PathUnescape(mediaURL[len(themeMediaURLPrefix):])
	if err != nil {
		return nil
	}
	path := filepath.Join(s.host.AppDataPath, themeMediaDir, name)
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// ShowMediaItemInFolder is a renderer affordance; stub until G8.
func (s *Service) ShowMediaItemInFolder(_ context.Context, _ string) error { return nil }

// ============================================================
// Stored themes (.xtheme files)
// ============================================================

const themesDir = "themes"

// GetStoredThemes lists `.xtheme` files (just the names, no extension).
func (s *Service) GetStoredThemes(_ context.Context) ([]contract.StoredTheme, error) {
	dir := filepath.Join(s.host.AppDataPath, themesDir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []contract.StoredTheme{}, nil
		}
		return nil, err
	}
	out := make([]contract.StoredTheme, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".xtheme") {
			continue
		}
		out = append(out, contract.StoredTheme{Name: strings.TrimSuffix(name, ".xtheme")})
	}
	return out, nil
}

// DeleteStoredTheme removes a stored theme bundle.
func (s *Service) DeleteStoredTheme(_ context.Context, name string) error {
	path := filepath.Join(s.host.AppDataPath, themesDir, name+".xtheme")
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// ============================================================
// Helpers
// ============================================================

func mediaTypeFromExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif":
		return "image"
	case ".mp4", ".webm":
		return "video"
	case ".mp3", ".wav", ".ogg":
		return "audio"
	case ".ttf", ".otf", ".woff", ".woff2":
		return "font"
	}
	return "image"
}

func mimeTypeFromExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".ttf":
		return "font/ttf"
	case ".otf":
		return "font/otf"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	}
	return "application/octet-stream"
}
