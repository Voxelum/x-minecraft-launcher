package instancescreenshot

import (
	"context"
	"net/url"
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

func TestGetScreenshots_Empty(t *testing.T) {
	s, _ := newTestService(t)
	got, err := s.GetScreenshots(context.Background(), t.TempDir())
	if err != nil {
		t.Fatalf("GetScreenshots: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %v", got)
	}
}

func TestGetScreenshotsOrdersByMtime(t *testing.T) {
	s, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	ss := filepath.Join(inst, "screenshots")
	if err := os.MkdirAll(ss, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	older := filepath.Join(ss, "older.png")
	newer := filepath.Join(ss, "newer.png")
	if err := os.WriteFile(older, []byte("a"), 0o644); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	pastTime := now.Add(-time.Hour)
	if err := os.Chtimes(older, pastTime, pastTime); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(newer, []byte("b"), 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := s.GetScreenshots(context.Background(), inst)
	if err != nil {
		t.Fatalf("GetScreenshots: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 entries, got %d", len(got))
	}
	if !strings.Contains(got[0], "newer.png") {
		t.Errorf("expected newer first, got %q", got[0])
	}
	if !strings.Contains(got[1], "older.png") {
		t.Errorf("expected older second, got %q", got[1])
	}
}

func TestDeleteScreenshot(t *testing.T) {
	s, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	ss := filepath.Join(inst, "screenshots")
	if err := os.MkdirAll(ss, 0o755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(ss, "shot.png")
	if err := os.WriteFile(target, []byte("png"), 0o644); err != nil {
		t.Fatal(err)
	}
	u := "http://launcher/media?path=" + url.QueryEscape(target)

	ok, err := s.DeleteScreenshot(context.Background(), u)
	if err != nil {
		t.Fatalf("DeleteScreenshot: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Errorf("file still present: %v", err)
	}

	// Second delete: nothing to remove → ok=false.
	ok, _ = s.DeleteScreenshot(context.Background(), u)
	if ok {
		t.Error("expected ok=false on second delete")
	}
}

func TestDeleteScreenshot_RejectsForeignURL(t *testing.T) {
	s, _ := newTestService(t)
	ok, err := s.DeleteScreenshot(context.Background(), "https://example.com/x.png")
	if err != nil {
		t.Fatalf("DeleteScreenshot: %v", err)
	}
	if ok {
		t.Error("expected ok=false for non-launcher URL")
	}
}
