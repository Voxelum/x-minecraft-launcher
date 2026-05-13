package resource

import (
	"context"
	"database/sql"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

// openTestDB returns a fresh in-memory SQLite handle with the
// resource schema applied.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared&_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := ensureSchema(db); err != nil {
		t.Fatalf("ensure schema: %v", err)
	}
	return db
}

// fixtureDir locates `<repo>/mock/mods` so we can exercise Parse +
// Scan against real jar fixtures.
func fixtureDir(t *testing.T) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	dir := cwd
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "mock", "mods")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
		next := filepath.Dir(dir)
		if next == dir {
			break
		}
		dir = next
	}
	t.Skipf("mock/mods/ fixtures not found; ran from %s", cwd)
	return ""
}

// silentLogger discards every log line so test output stays focused.
func silentLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// =============================================================================
// Schema / DB
// =============================================================================

func TestEnsureSchemaIsIdempotent(t *testing.T) {
	db := openTestDB(t)
	if err := ensureSchema(db); err != nil {
		t.Fatalf("re-apply: %v", err)
	}
	// Round-trip a snapshot to prove every column is present.
	snap := Snapshot{
		DomainedPath: "mods/x.jar",
		Ino:          1,
		Mtime:        2,
		FileType:     FileTypeForge,
		SHA1:         "deadbeef",
	}
	if err := upsertSnapshot(db, snap); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	got, err := snapshotByPath(db, snap.DomainedPath)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if got == nil || got.SHA1 != "deadbeef" {
		t.Fatalf("unexpected: %#v", got)
	}
}

// =============================================================================
// Hashing
// =============================================================================

func TestSHA1OfFile(t *testing.T) {
	tmp := filepath.Join(t.TempDir(), "h.txt")
	if err := os.WriteFile(tmp, []byte("hello"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	got, err := SHA1OfFile(tmp)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	const want = "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d"
	if got != want {
		t.Fatalf("sha1 mismatch: %s ≠ %s", got, want)
	}
}

func TestFingerprintStripsWhitespace(t *testing.T) {
	// "abcd" and " a b c d \n" must hash to the same fingerprint —
	// the algorithm normalises whitespace before hashing.
	a := fingerprintBytes([]byte("abcd"))
	b := fingerprintBytes([]byte(" a b c d \n"))
	if a == 0 || a != b {
		t.Fatalf("fingerprint mismatch: %d vs %d", a, b)
	}
}

// =============================================================================
// Manager
// =============================================================================

func TestManagerScanCachesAcrossInvocations(t *testing.T) {
	dir := fixtureDir(t)
	if dir == "" {
		return
	}
	tmp := t.TempDir()
	mods := filepath.Join(tmp, "mods")
	if err := os.MkdirAll(mods, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	// Hard-link a real jar fixture into the scan dir.
	src := filepath.Join(dir, "fabric-sample.jar")
	dst := filepath.Join(mods, "fabric-sample.jar")
	if err := os.Link(src, dst); err != nil {
		// Cross-device → copy.
		raw, err := os.ReadFile(src)
		if err != nil {
			t.Fatalf("read fixture: %v", err)
		}
		if err := os.WriteFile(dst, raw, 0o644); err != nil {
			t.Fatalf("write fixture: %v", err)
		}
	}

	db := openTestDB(t)
	mgr, err := Open(db, silentLogger())
	if err != nil {
		t.Fatalf("open mgr: %v", err)
	}

	// First call: cold path. Snapshot row should land + parse should
	// produce a fabric metadata blob.
	first, err := mgr.Scan(context.Background(), mods, DomainMods)
	if err != nil {
		t.Fatalf("scan #1: %v", err)
	}
	if len(first) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(first))
	}
	if first[0].Snapshot.SHA1 == "" {
		t.Fatalf("snapshot missing sha1: %#v", first[0])
	}
	if first[0].Stored == nil || first[0].Stored.Metadata["fabric"] == nil {
		t.Fatalf("expected fabric metadata, got: %#v", first[0].Stored)
	}

	// Second call: snapshot row should match (ino + mtime unchanged).
	// We can't directly observe whether the slow path ran, but we
	// can check the snapshot is still present and identical.
	snap, err := mgr.SnapshotByPath("mods/fabric-sample.jar")
	if err != nil || snap == nil {
		t.Fatalf("snapshot by path: %v", err)
	}
	second, err := mgr.Scan(context.Background(), mods, DomainMods)
	if err != nil {
		t.Fatalf("scan #2: %v", err)
	}
	if len(second) != 1 || second[0].Snapshot.SHA1 != first[0].Snapshot.SHA1 {
		t.Fatalf("snapshot drifted between scans")
	}

	// Search by name should resolve back to the same record.
	hits, err := mgr.SearchByName("fabric-sample", DomainMods)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(hits) != 1 || hits[0].SHA1 != first[0].Snapshot.SHA1 {
		t.Fatalf("expected 1 search hit, got %#v", hits)
	}
}

func TestManagerSnapshotInvalidatesOnMtimeChange(t *testing.T) {
	tmp := t.TempDir()
	mods := filepath.Join(tmp, "mods")
	if err := os.MkdirAll(mods, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	jar := filepath.Join(mods, "x.jar")
	if err := os.WriteFile(jar, []byte("not really a jar"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	db := openTestDB(t)
	mgr, err := Open(db, silentLogger())
	if err != nil {
		t.Fatalf("open mgr: %v", err)
	}
	if _, err := mgr.Scan(context.Background(), mods, DomainMods); err != nil {
		t.Fatalf("scan #1: %v", err)
	}
	first, _ := mgr.SnapshotByPath("mods/x.jar")
	if first == nil {
		t.Fatalf("first snapshot missing")
	}

	// Touch the file so mtime advances by ≥ 1 ms.
	future := time.UnixMilli(first.Mtime).Add(time.Minute)
	if err := os.Chtimes(jar, future, future); err != nil {
		t.Fatalf("chtimes: %v", err)
	}
	if _, err := mgr.Scan(context.Background(), mods, DomainMods); err != nil {
		t.Fatalf("scan #2: %v", err)
	}
	second, _ := mgr.SnapshotByPath("mods/x.jar")
	if second == nil || second.Mtime == first.Mtime {
		t.Fatalf("expected mtime to have advanced; first=%d second=%v", first.Mtime, second)
	}
}
