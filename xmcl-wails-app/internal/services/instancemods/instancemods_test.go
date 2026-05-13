package instancemods

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// fixtureMod resolves a path under the repo's `mock/mods/` directory.
// Walks up from the package dir like the other parser tests do.
func fixtureMod(t *testing.T, name string) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	dir := cwd
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "mock", "mods", name)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		next := filepath.Dir(dir)
		if next == dir {
			break
		}
		dir = next
	}
	t.Skipf("mock/mods/%s not found", name)
	return ""
}

func newTestService(t *testing.T) (*Service, *host.Host, string) {
	t.Helper()
	dir := t.TempDir()
	h := &host.Host{
		AppDataPath:       filepath.Join(dir, "appdata"),
		MinecraftDataPath: filepath.Join(dir, "mc"),
		Logger:            slog.New(slog.NewTextHandler(io.Discard, nil)),
		Mutex:             host.NewMutexManager(),
	}
	b := bridge.New(h)
	return New(h, b.States()), h, dir
}

func TestWatchEmptyInstance(t *testing.T) {
	s, _, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	if err := os.MkdirAll(inst, 0o755); err != nil {
		t.Fatal(err)
	}

	state, err := s.Watch(context.Background(), inst)
	if err != nil {
		t.Fatalf("Watch: %v", err)
	}
	if state == nil {
		t.Fatal("nil state")
	}
	w := s.watches[inst]
	if w == nil {
		t.Fatal("no watch cached")
	}
	if len(w.payload.Files) != 0 {
		t.Errorf("expected empty Files, got %v", w.payload.Files)
	}
}

func TestWatchPopulatesFiles(t *testing.T) {
	s, _, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	mods := filepath.Join(inst, "mods")
	if err := os.MkdirAll(mods, 0o755); err != nil {
		t.Fatal(err)
	}

	// Drop two real mod jars in.
	for _, src := range []string{
		fixtureMod(t, "fabric-sample.jar"),
		fixtureMod(t, "sample-mod-1.13.jar"),
	} {
		if src == "" {
			continue
		}
		if err := copyTo(src, filepath.Join(mods, filepath.Base(src))); err != nil {
			t.Fatalf("copy: %v", err)
		}
	}

	if _, err := s.Watch(context.Background(), inst); err != nil {
		t.Fatalf("Watch: %v", err)
	}
	files := s.watches[inst].payload.Files
	if len(files) != 2 {
		t.Fatalf("Files = %d, want 2", len(files))
	}

	// One should have Forge/Toml metadata (1.13 sample), one shouldn't
	// (fabric-only).
	var sawForge bool
	for _, raw := range files {
		m, ok := raw.(map[string]any)
		if !ok {
			t.Fatalf("file entry not a map: %T", raw)
		}
		if m["fileName"] == "" {
			t.Errorf("missing fileName: %v", m)
		}
		if md, ok := m["metadata"].(map[string]any); ok {
			if _, has := md["forge"]; has && md["forge"] != nil {
				sawForge = true
			}
		}
	}
	if !sawForge {
		t.Error("expected at least one mod with forge metadata")
	}
}

func TestEnableDisableRename(t *testing.T) {
	s, _, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	mods := filepath.Join(inst, "mods")
	if err := os.MkdirAll(mods, 0o755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(mods, "sample.jar")
	if err := os.WriteFile(target, []byte("dummy"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Disable: should append .disabled
	if err := s.Disable(context.Background(), contract.UpdateInstanceResourcesOptions{
		Files: []string{target},
		Path:  inst,
	}); err != nil {
		t.Fatalf("Disable: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Errorf("original file still present after disable: %v", err)
	}
	disabled := target + ".disabled"
	if _, err := os.Stat(disabled); err != nil {
		t.Errorf("disabled file missing: %v", err)
	}

	// Enable: should strip .disabled
	if err := s.Enable(context.Background(), contract.UpdateInstanceResourcesOptions{
		Files: []string{disabled},
		Path:  inst,
	}); err != nil {
		t.Fatalf("Enable: %v", err)
	}
	if _, err := os.Stat(disabled); !os.IsNotExist(err) {
		t.Errorf("disabled file still present after enable: %v", err)
	}
	if _, err := os.Stat(target); err != nil {
		t.Errorf("enabled file missing: %v", err)
	}
}

func TestEnableSkipsUnmanagedPath(t *testing.T) {
	s, _, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	// Drop a "disabled" file outside the mods folder; service must
	// ignore it (log warn but not rename).
	other := filepath.Join(dir, "stray.jar.disabled")
	if err := os.WriteFile(other, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := s.Enable(context.Background(), contract.UpdateInstanceResourcesOptions{
		Files: []string{other},
		Path:  inst,
	}); err != nil {
		t.Fatalf("Enable: %v", err)
	}
	// File should be untouched.
	if _, err := os.Stat(other); err != nil {
		t.Errorf("file got renamed despite being unmanaged: %v", err)
	}
}

func TestInstallCopiesIntoModsDir(t *testing.T) {
	s, _, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	src := filepath.Join(dir, "incoming.jar")
	if err := os.WriteFile(src, []byte("payload"), 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := s.Install(context.Background(), contract.UpdateInstanceResourcesOptions{
		Files: []string{src},
		Path:  inst,
	})
	if err != nil {
		t.Fatalf("Install: %v", err)
	}
	want := filepath.Join(inst, "mods", "incoming.jar")
	if len(got) != 1 || got[0] != want {
		t.Errorf("Install returned %v, want [%s]", got, want)
	}
	if _, err := os.Stat(want); err != nil {
		t.Errorf("file missing at destination: %v", err)
	}
}

func TestUninstallIdempotent(t *testing.T) {
	s, _, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	mods := filepath.Join(inst, "mods")
	if err := os.MkdirAll(mods, 0o755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(mods, "old.jar")
	if err := os.WriteFile(target, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 2; i++ {
		if err := s.Uninstall(context.Background(), contract.UpdateInstanceResourcesOptions{
			Files: []string{target},
			Path:  inst,
		}); err != nil {
			t.Fatalf("Uninstall iter %d: %v", i, err)
		}
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Errorf("file should be gone: %v", err)
	}
}

func TestRefreshMetadataRescans(t *testing.T) {
	s, _, dir := newTestService(t)
	inst := filepath.Join(dir, "Inst")
	mods := filepath.Join(inst, "mods")
	if err := os.MkdirAll(mods, 0o755); err != nil {
		t.Fatal(err)
	}

	if _, err := s.Watch(context.Background(), inst); err != nil {
		t.Fatal(err)
	}
	if got := len(s.watches[inst].payload.Files); got != 0 {
		t.Errorf("initial Files = %d, want 0", got)
	}

	// Add a file under the watched directory.
	if err := os.WriteFile(filepath.Join(mods, "new.jar"), []byte("payload"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := s.RefreshMetadata(context.Background(), inst); err != nil {
		t.Fatalf("RefreshMetadata: %v", err)
	}
	if got := len(s.watches[inst].payload.Files); got != 1 {
		t.Errorf("after refresh Files = %d, want 1", got)
	}
}

// ============================================================
// helpers
// ============================================================

func copyTo(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}
