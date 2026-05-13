package instancelog

import (
	"compress/gzip"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/voxelum/xmcl/wails/internal/host"
)

func newTestService(t *testing.T) (*Service, string) {
	t.Helper()
	dir := t.TempDir()
	h := &host.Host{AppDataPath: filepath.Join(dir, "appdata")}
	return New(h, nil), dir
}

func TestListLogsEmpty(t *testing.T) {
	s, _ := newTestService(t)
	got, err := s.ListLogs(context.Background(), t.TempDir())
	if err != nil {
		t.Fatalf("ListLogs: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty list, got %v", got)
	}
}

func TestListLogsSplitsLaunchFailures(t *testing.T) {
	s, dir := newTestService(t)
	logs := filepath.Join(dir, "Inst", "logs")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		t.Fatal(err)
	}
	// One regular log and one launch failure.
	for _, n := range []string{"latest.log", "launch-failure-2025-01-01.txt"} {
		path := filepath.Join(logs, n)
		if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	regular, err := s.ListLogs(context.Background(), filepath.Join(dir, "Inst"))
	if err != nil {
		t.Fatal(err)
	}
	if len(regular) != 1 || regular[0] != "latest.log" {
		t.Errorf("regular logs = %v", regular)
	}

	failures, err := s.ListLaunchFailures(context.Background(), filepath.Join(dir, "Inst"))
	if err != nil {
		t.Fatal(err)
	}
	if len(failures) != 1 || !strings.HasPrefix(failures[0], "launch-failure-") {
		t.Errorf("failures = %v", failures)
	}
}

func TestGetLogContentDecompressesGzip(t *testing.T) {
	s, dir := newTestService(t)
	logs := filepath.Join(dir, "Inst", "logs")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		t.Fatal(err)
	}

	target := filepath.Join(logs, "old.log.gz")
	f, err := os.Create(target)
	if err != nil {
		t.Fatal(err)
	}
	gz := gzip.NewWriter(f)
	if _, err := gz.Write([]byte("hello compressed log\n")); err != nil {
		t.Fatal(err)
	}
	gz.Close()
	f.Close()

	content, err := s.GetLogContent(context.Background(), filepath.Join(dir, "Inst"), "old.log.gz")
	if err != nil {
		t.Fatalf("GetLogContent: %v", err)
	}
	if !strings.Contains(content, "hello compressed log") {
		t.Errorf("content = %q", content)
	}
}

func TestRemoveLogIdempotent(t *testing.T) {
	s, dir := newTestService(t)
	logs := filepath.Join(dir, "Inst", "logs")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(logs, "latest.log")
	if err := os.WriteFile(target, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := s.RemoveLog(context.Background(), filepath.Join(dir, "Inst"), "latest.log"); err != nil {
		t.Fatalf("RemoveLog: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Errorf("file still present: %v", err)
	}
	// Second call must not error.
	if err := s.RemoveLog(context.Background(), filepath.Join(dir, "Inst"), "latest.log"); err != nil {
		t.Errorf("second RemoveLog errored: %v", err)
	}
}

func TestListLogsOrdersNewestFirst(t *testing.T) {
	s, dir := newTestService(t)
	logs := filepath.Join(dir, "Inst", "logs")
	if err := os.MkdirAll(logs, 0o755); err != nil {
		t.Fatal(err)
	}
	older := filepath.Join(logs, "first.log")
	newer := filepath.Join(logs, "second.log")
	if err := os.WriteFile(older, []byte("a"), 0o644); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-time.Hour)
	if err := os.Chtimes(older, past, past); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(newer, []byte("b"), 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := s.ListLogs(context.Background(), filepath.Join(dir, "Inst"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != "second.log" || got[1] != "first.log" {
		t.Errorf("order wrong: %v", got)
	}
}
