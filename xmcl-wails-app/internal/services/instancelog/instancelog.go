// Package instancelog implements contract.InstanceLogService.
//
// Reads / removes log + crash-report files under
// `<instance>/logs/` and `<instance>/crash-reports/`. Log files are
// often gzip-compressed (`*.log.gz`) — we decompress on read but
// keep the on-disk extension intact so the renderer's filter stays
// correct.
package instancelog

import (
	"compress/gzip"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// LaunchFailurePrefix marks the per-failure log file the launcher
// writes when a JVM exits non-zero. Mirrors the TS constant.
const LaunchFailurePrefix = "launch-failure-"

// Service implements contract.InstanceLogService.
type Service struct {
	contract.InstanceLogServiceNotImplemented

	host *host.Host
}

// New constructs an InstanceLogService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.InstanceLogService = (*Service)(nil)

// ============================================================
// logs/
// ============================================================

func (s *Service) ListLogs(_ context.Context, instancePath string) ([]string, error) {
	return listDir(filepath.Join(instancePath, "logs"), func(name string) bool {
		return !strings.HasPrefix(name, LaunchFailurePrefix)
	})
}

func (s *Service) ListLaunchFailures(_ context.Context, instancePath string) ([]string, error) {
	return listDir(filepath.Join(instancePath, "logs"), func(name string) bool {
		return strings.HasPrefix(name, LaunchFailurePrefix)
	})
}

func (s *Service) GetLogContent(_ context.Context, instancePath string, name string) (string, error) {
	return readMaybeGzipped(filepath.Join(instancePath, "logs", name))
}

func (s *Service) RemoveLog(_ context.Context, instancePath string, name string) error {
	return removeIfExists(filepath.Join(instancePath, "logs", name))
}

// ============================================================
// crash-reports/
// ============================================================

func (s *Service) ListCrashReports(_ context.Context, instancePath string) ([]string, error) {
	return listDir(filepath.Join(instancePath, "crash-reports"), nil)
}

func (s *Service) GetCrashReportContent(_ context.Context, instancePath string, name string) (string, error) {
	return readMaybeGzipped(filepath.Join(instancePath, "crash-reports", name))
}

func (s *Service) RemoveCrashReport(_ context.Context, instancePath string, name string) error {
	return removeIfExists(filepath.Join(instancePath, "crash-reports", name))
}

// ============================================================
// "Show in folder" — stubs (G8)
// ============================================================

func (s *Service) ShowLog(_ context.Context, _ string, _ string) error   { return nil }
func (s *Service) ShowCrash(_ context.Context, _ string, _ string) error { return nil }

// ============================================================
// Helpers
// ============================================================

// listDir returns sorted-by-mtime-desc file names. Optional filter
// lets callers carve out launch-failure logs from regular ones.
func listDir(dir string, keep func(name string) bool) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []string{}, nil
		}
		return nil, err
	}

	type row struct {
		name    string
		modTime int64
	}
	rows := make([]row, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if keep != nil && !keep(e.Name()) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		rows = append(rows, row{name: e.Name(), modTime: info.ModTime().UnixNano()})
	}
	// Newest first.
	for i := 1; i < len(rows); i++ {
		x, j := rows[i], i
		for ; j > 0 && rows[j-1].modTime < x.modTime; j-- {
			rows[j] = rows[j-1]
		}
		rows[j] = x
	}
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = r.name
	}
	return out, nil
}

func readMaybeGzipped(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	if strings.HasSuffix(path, ".gz") {
		gz, err := gzip.NewReader(f)
		if err != nil {
			return "", err
		}
		defer gz.Close()
		data, err := io.ReadAll(gz)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}

	data, err := io.ReadAll(f)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func removeIfExists(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
