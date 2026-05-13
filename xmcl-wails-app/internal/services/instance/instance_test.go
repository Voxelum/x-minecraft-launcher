package instance

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/host"
)

// newTestService builds an InstanceService backed by a throwaway
// host rooted at t.TempDir(). The host has a no-op (discard) logger
// so failed tests don't spam stderr.
func newTestService(t *testing.T) (*Service, *host.Host) {
	t.Helper()
	dir := t.TempDir()
	h := &host.Host{
		AppDataPath:       filepath.Join(dir, "appdata"),
		MinecraftDataPath: filepath.Join(dir, "mc"),
		OS:                "linux",
		Arch:              "amd64",
		Logger:            slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError + 1})),
		Mutex:             host.NewMutexManager(),
	}
	if err := os.MkdirAll(h.AppDataPath, 0o755); err != nil {
		t.Fatalf("mkdir appdata: %v", err)
	}
	if err := os.MkdirAll(h.MinecraftDataPath, 0o755); err != nil {
		t.Fatalf("mkdir mc: %v", err)
	}
	b := bridge.New(h)
	return New(h, b.States()), h
}

func TestCreateAndList(t *testing.T) {
	s, h := newTestService(t)
	path, err := s.CreateInstance(context.Background(), map[string]any{
		"name": "My Instance",
		"runtime": map[string]any{
			"minecraft": "1.20.1",
		},
	})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if path == "" {
		t.Fatal("CreateInstance returned empty path")
	}
	expected := filepath.Join(h.MinecraftDataPath, "instances", "My Instance")
	if path != expected {
		t.Errorf("path = %q, want %q", path, expected)
	}

	// instance.json must exist with the seeded name.
	manifest, err := os.ReadFile(filepath.Join(path, "instance.json"))
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	if !contains(manifest, "My Instance") {
		t.Errorf("manifest missing name: %s", manifest)
	}
	if !contains(manifest, "1.20.1") {
		t.Errorf("manifest missing mc version: %s", manifest)
	}

	// State should now carry exactly one instance.
	state, err := s.GetSharedInstancesState(context.Background())
	if err != nil {
		t.Fatalf("GetSharedInstancesState: %v", err)
	}
	if state == nil {
		t.Fatal("nil state")
	}
	if len(s.payload.Instances) != 1 {
		t.Errorf("instances=%d, want 1", len(s.payload.Instances))
	}
}

func TestEditMergesFields(t *testing.T) {
	s, _ := newTestService(t)
	path, err := s.CreateInstance(context.Background(), map[string]any{
		"name": "Edit Me",
	})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	if err := s.EditInstance(context.Background(), map[string]any{
		"instancePath": path,
		"description":  "Now with description",
		"author":       "tester",
	}); err != nil {
		t.Fatalf("EditInstance: %v", err)
	}

	manifest, err := os.ReadFile(filepath.Join(path, "instance.json"))
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	if !contains(manifest, "Now with description") {
		t.Errorf("description not persisted: %s", manifest)
	}
	if !contains(manifest, "tester") {
		t.Errorf("author not persisted: %s", manifest)
	}
	if !contains(manifest, "Edit Me") {
		t.Errorf("name lost in merge: %s", manifest)
	}
}

func TestDeleteRemovesManifest(t *testing.T) {
	s, _ := newTestService(t)
	path, err := s.CreateInstance(context.Background(), map[string]any{"name": "Goner"})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	if err := s.DeleteInstance(context.Background(), path, false); err != nil {
		t.Fatalf("DeleteInstance: %v", err)
	}

	if _, err := os.Stat(filepath.Join(path, "instance.json")); !os.IsNotExist(err) {
		t.Errorf("instance.json still present: %v", err)
	}

	if _, exists := s.instances[path]; exists {
		t.Error("path still in service map")
	}
}

func TestDeleteWithData(t *testing.T) {
	s, _ := newTestService(t)
	path, err := s.CreateInstance(context.Background(), map[string]any{"name": "Data Gone"})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	// Drop a sibling file so we can confirm the whole dir disappears.
	if err := os.WriteFile(filepath.Join(path, "saves.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatalf("write saves.txt: %v", err)
	}

	if err := s.DeleteInstance(context.Background(), path, true); err != nil {
		t.Fatalf("DeleteInstance: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("instance dir still present: %v", err)
	}
}

func TestDuplicate(t *testing.T) {
	s, _ := newTestService(t)
	orig, err := s.CreateInstance(context.Background(), map[string]any{"name": "Cloneable"})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}

	dup, err := s.DuplicateInstance(context.Background(), orig)
	if err != nil {
		t.Fatalf("DuplicateInstance: %v", err)
	}
	if dup == "" || dup == orig {
		t.Errorf("duplicate path bad: %q (orig %q)", dup, orig)
	}
	if _, err := os.Stat(filepath.Join(dup, "instance.json")); err != nil {
		t.Errorf("dup manifest missing: %v", err)
	}
}

func TestDiscoveryFromDisk(t *testing.T) {
	// Drop two pre-existing instances on disk, then bring the
	// service up — discovery should populate state without any
	// explicit calls.
	s, h := newTestService(t)
	instancesDir := filepath.Join(h.MinecraftDataPath, "instances")
	for _, name := range []string{"Alpha", "Beta"} {
		dir := filepath.Join(instancesDir, name)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("mkdir: %v", err)
		}
		manifest := `{"name":"` + name + `","runtime":{"minecraft":"1.20.1"}}`
		if err := os.WriteFile(filepath.Join(dir, "instance.json"), []byte(manifest), 0o644); err != nil {
			t.Fatalf("write manifest: %v", err)
		}
	}

	if _, err := s.GetSharedInstancesState(context.Background()); err != nil {
		t.Fatalf("GetSharedInstancesState: %v", err)
	}
	if got := len(s.payload.Instances); got != 2 {
		t.Errorf("instances=%d, want 2", got)
	}
}

func TestValidateInstancePath(t *testing.T) {
	s, h := newTestService(t)

	// Empty / relative paths fail.
	if got, _ := s.ValidateInstancePath(context.Background(), ""); got != "bad" {
		t.Errorf("empty path code = %q, want bad", got)
	}
	if got, _ := s.ValidateInstancePath(context.Background(), "rel/path"); got != "bad" {
		t.Errorf("relative path code = %q, want bad", got)
	}

	// Fresh absolute path is acceptable.
	target := filepath.Join(h.MinecraftDataPath, "fresh-dir")
	if got, _ := s.ValidateInstancePath(context.Background(), target); got != "" {
		t.Errorf("fresh dir code = %q, want empty", got)
	}

	// A path that already holds an instance.json is rejected.
	occupied := filepath.Join(h.MinecraftDataPath, "occupied")
	if err := os.MkdirAll(occupied, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(occupied, "instance.json"), []byte("{}"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	if got, _ := s.ValidateInstancePath(context.Background(), occupied); got != "exists" {
		t.Errorf("occupied code = %q, want exists", got)
	}
}

func contains(haystack []byte, needle string) bool {
	return len(haystack) >= len(needle) && (string(haystack) == needle ||
		findSubstring(haystack, []byte(needle)))
}

func findSubstring(h, n []byte) bool {
	if len(n) == 0 {
		return true
	}
	for i := 0; i+len(n) <= len(h); i++ {
		match := true
		for j := 0; j < len(n); j++ {
			if h[i+j] != n[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
