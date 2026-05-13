// Package instancetheme implements contract.InstanceThemeService.
//
// Per-instance theme.json + theme-media/ live under each instance
// directory. We delegate the IO to the same helpers used by the
// global ThemeService where it makes sense.
package instancetheme

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

// Service implements contract.InstanceThemeService.
type Service struct {
	contract.InstanceThemeServiceNotImplemented

	host *host.Host
}

// New constructs an InstanceThemeService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.InstanceThemeService = (*Service)(nil)

const (
	themeFile           = "theme.json"
	themeMediaDir       = "theme-media"
	themeMediaURLPrefix = "http://launcher/theme-media/"
)

// GetInstanceTheme returns the per-instance theme override, or nil
// when none is set.
func (s *Service) GetInstanceTheme(_ context.Context, instancePath string) (*contract.ThemeData, error) {
	if instancePath == "" {
		return nil, nil
	}
	data, err := os.ReadFile(filepath.Join(instancePath, themeFile))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	var t contract.ThemeData
	if err := json.Unmarshal(data, &t); err != nil {
		s.host.Logger.Warn("instancetheme: parse failed", "instance", instancePath, "err", err)
		return nil, nil
	}
	return &t, nil
}

// SetInstanceTheme writes the per-instance theme override. Pass a
// nil value to clear it (we then remove the file rather than write
// an empty document).
func (s *Service) SetInstanceTheme(_ context.Context, instancePath string, theme *contract.ThemeData) error {
	if instancePath == "" {
		return errors.New("SetInstanceTheme: instancePath required")
	}
	target := filepath.Join(instancePath, themeFile)
	if theme == nil {
		if err := os.Remove(target); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}
	if err := os.MkdirAll(instancePath, 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(*theme, "", "  ")
	if err != nil {
		return err
	}
	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}

// AddMedia copies `filePath` into `<instance>/theme-media/`.
func (s *Service) AddMedia(_ context.Context, instancePath string, filePath string) (contract.MediaData, error) {
	src, err := os.ReadFile(filePath)
	if err != nil {
		return contract.MediaData{}, err
	}
	dir := filepath.Join(instancePath, themeMediaDir)
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
func (s *Service) RemoveMedia(_ context.Context, instancePath string, mediaURL string) error {
	if !strings.HasPrefix(mediaURL, themeMediaURLPrefix) {
		return nil
	}
	name, err := url.PathUnescape(mediaURL[len(themeMediaURLPrefix):])
	if err != nil {
		return nil
	}
	path := filepath.Join(instancePath, themeMediaDir, name)
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// CopyMediaFromGlobal moves the file from the global theme-media
// folder into the per-instance one (the renderer triggers this when
// the user "saves" a global theme as an instance override).
func (s *Service) CopyMediaFromGlobal(_ context.Context, instancePath string, mediaURL string) (contract.MediaData, error) {
	if !strings.HasPrefix(mediaURL, themeMediaURLPrefix) {
		return contract.MediaData{}, errors.New("CopyMediaFromGlobal: not a theme-media URL")
	}
	name, err := url.PathUnescape(mediaURL[len(themeMediaURLPrefix):])
	if err != nil {
		return contract.MediaData{}, err
	}
	src := filepath.Join(s.host.AppDataPath, themeMediaDir, name)
	dstDir := filepath.Join(instancePath, themeMediaDir)
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		return contract.MediaData{}, err
	}
	data, err := os.ReadFile(src)
	if err != nil {
		return contract.MediaData{}, err
	}
	if err := os.WriteFile(filepath.Join(dstDir, name), data, 0o644); err != nil {
		return contract.MediaData{}, err
	}
	return contract.MediaData{
		Url:      themeMediaURLPrefix + url.PathEscape(name),
		Type:     mediaTypeFromExt(filepath.Ext(name)),
		MimeType: mimeTypeFromExt(filepath.Ext(name)),
	}, nil
}

// ShowMediaInFolder — stub for G8.
func (s *Service) ShowMediaInFolder(_ context.Context, _ string, _ string) error { return nil }

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
