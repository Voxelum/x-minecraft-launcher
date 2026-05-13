// Package instancescreenshot implements contract.InstanceScreenshotService.
//
// Reads `<instance>/screenshots/` and returns each entry as a
// `http://launcher/media?path=…` URL. The renderer resolves these
// URLs through the custom asset handler installed in G8; for now the
// URLs are accepted by `<img>` because Wails forwards them to the
// host (or 404s gracefully).
package instancescreenshot

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.InstanceScreenshotService.
type Service struct {
	contract.InstanceScreenshotServiceNotImplemented

	host *host.Host
}

// New constructs an InstanceScreenshotService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.InstanceScreenshotService = (*Service)(nil)

// GetScreenshots lists screenshot files in newest-first order.
func (s *Service) GetScreenshots(_ context.Context, instancePath string) ([]string, error) {
	if instancePath == "" {
		return []string{}, nil
	}
	dir := filepath.Join(instancePath, "screenshots")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []string{}, nil
		}
		return nil, err
	}

	// Mtime-desc sort so the most recent shot lands first.
	type entry struct {
		name    string
		modTime int64
	}
	rows := make([]entry, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !looksLikeImage(e.Name()) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		rows = append(rows, entry{name: e.Name(), modTime: info.ModTime().UnixNano()})
	}
	// Insertion sort — N is tiny in practice.
	for i := 1; i < len(rows); i++ {
		x, j := rows[i], i
		for ; j > 0 && rows[j-1].modTime < x.modTime; j-- {
			rows[j] = rows[j-1]
		}
		rows[j] = x
	}

	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, "http://launcher/media?path="+url.QueryEscape(filepath.Join(dir, r.name)))
	}
	return out, nil
}

// DeleteScreenshot removes a screenshot whose URL was previously
// returned by GetScreenshots. Returns true when the file actually
// disappeared.
func (s *Service) DeleteScreenshot(_ context.Context, mediaURL string) (bool, error) {
	path := mediaPathFromURL(mediaURL)
	if path == "" {
		return false, nil
	}
	if err := os.Remove(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// ShowScreenshot opens the host's image viewer. Stub for G6;
// implemented in G8 alongside the rest of the file-manager affordances.
func (s *Service) ShowScreenshot(_ context.Context, _ string) error { return nil }

// ============================================================
// Helpers
// ============================================================

func looksLikeImage(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp":
		return true
	}
	return false
}

func mediaPathFromURL(u string) string {
	const prefix = "http://launcher/media?path="
	if !strings.HasPrefix(u, prefix) {
		return ""
	}
	decoded, err := url.QueryUnescape(u[len(prefix):])
	if err != nil {
		return ""
	}
	return decoded
}
