package projectmapping

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/voxelum/xmcl/wails/internal/host"
)

func seedDB(t *testing.T, path string) {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()
	stmts := []string{
		`CREATE TABLE project (modrinthId TEXT, curseforgeId INTEGER, name TEXT, description TEXT)`,
		`INSERT INTO project VALUES ('jeiMR', 238222, 'JEI', 'Just Enough Items')`,
		`INSERT INTO project VALUES ('AANobbMI', 394468, 'Sodium', 'Performance optimizer')`,
		`INSERT INTO project VALUES ('xyz', 11111, 'Other Mod', 'Unrelated')`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
}

// newSeeded constructs a Service whose `cached` field is pre-populated
// against a synthetic DB to bypass the network download path.
func newSeeded(t *testing.T) *Service {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "project-mapping-en.sqlite")
	seedDB(t, dbPath)
	h := host.New()
	h.AppDataPath = dir
	s := New(h, nil)
	db, err := openReadOnly(dbPath)
	if err != nil {
		t.Fatalf("openReadOnly: %v", err)
	}
	s.cached = &cachedDB{locale: "en", db: db, path: dbPath}
	// Windows holds an exclusive lock on the open SQLite file —
	// close before t.TempDir tries to RemoveAll.
	t.Cleanup(func() { _ = db.Close() })
	return s
}

func TestLookupByModrinthAndCurseforge(t *testing.T) {
	s := newSeeded(t)
	ctx := context.Background()

	mr, err := s.LookupByModrinth(ctx, "jeiMR")
	if err != nil || mr == nil {
		t.Fatalf("LookupByModrinth: got=%v err=%v", mr, err)
	}
	if mr.ModrinthId != "jeiMR" || mr.CurseforgeId != 238222 || mr.Name != "JEI" {
		t.Fatalf("bad mapping: %+v", mr)
	}

	cf, err := s.LookupByCurseforge(ctx, 394468)
	if err != nil || cf == nil {
		t.Fatalf("LookupByCurseforge: got=%v err=%v", cf, err)
	}
	if cf.ModrinthId != "AANobbMI" || cf.Name != "Sodium" {
		t.Fatalf("bad mapping: %+v", cf)
	}

	// Unknown lookup → nil, nil.
	if mr, err := s.LookupByModrinth(ctx, "missing"); err != nil || mr != nil {
		t.Fatalf("LookupByModrinth(unknown): %v %v", mr, err)
	}
}

func TestLookupByKeyword(t *testing.T) {
	s := newSeeded(t)
	rows, err := s.LookupByKeyword(context.Background(), "Sod")
	if err != nil {
		t.Fatalf("LookupByKeyword: %v", err)
	}
	if len(rows) != 1 || rows[0].ModrinthId != "AANobbMI" {
		t.Fatalf("rows: %+v", rows)
	}

	// Description match too.
	rows, _ = s.LookupByKeyword(context.Background(), "Just Enough")
	if len(rows) != 1 || rows[0].ModrinthId != "jeiMR" {
		t.Fatalf("desc rows: %+v", rows)
	}

	// Empty keyword → empty slice (not all rows).
	rows, _ = s.LookupByKeyword(context.Background(), "  ")
	if len(rows) != 0 {
		t.Fatalf("empty keyword should return 0 rows; got %d", len(rows))
	}
}

func TestLookupBatch(t *testing.T) {
	s := newSeeded(t)
	rows, err := s.LookupBatch(context.Background(), []string{"jeiMR"}, []float64{394468})
	if err != nil {
		t.Fatalf("LookupBatch: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d: %+v", len(rows), rows)
	}
}
