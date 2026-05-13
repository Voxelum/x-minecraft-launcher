package modmetadata

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/voxelum/xmcl/wails/internal/host"
)

// seedDB creates a writable copy of the upstream `db.sqlite` schema
// at `path` and inserts a couple of representative rows. The
// sqlite-driver registration in modmetadata.go also satisfies this
// test file via the blank import above.
func seedDB(t *testing.T, path string) {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()

	stmts := []string{
		`CREATE TABLE file (sha1 TEXT PRIMARY KEY, name TEXT, domain TEXT)`,
		`CREATE TABLE project_mapping (curseforge_project INTEGER, modrinth_project TEXT)`,
		`CREATE TABLE forge_mod (sha1 TEXT, id TEXT, version TEXT)`,
		`CREATE TABLE fabric_mod (sha1 TEXT, id TEXT, version TEXT)`,
		`CREATE TABLE modrinth_version (sha1 TEXT, project TEXT, version TEXT)`,
		`CREATE TABLE curseforge_file (sha1 TEXT, project INTEGER, file INTEGER)`,

		`INSERT INTO file VALUES ('aaa', 'JEI', 'mods')`,
		`INSERT INTO file VALUES ('bbb', 'Sodium', 'mods')`,

		`INSERT INTO forge_mod VALUES ('aaa', 'jei', '11.0.0')`,
		`INSERT INTO fabric_mod VALUES ('bbb', 'sodium', '0.4.0')`,
		`INSERT INTO modrinth_version VALUES ('bbb', 'AANobbMI', 'abc123')`,
		`INSERT INTO curseforge_file VALUES ('aaa', 238222, 4500000)`,

		`INSERT INTO project_mapping VALUES (238222, 'jei-modrinth-id')`,
		`INSERT INTO project_mapping VALUES (394468, 'AANobbMI')`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
}

// newServiceWithSeed returns a Service whose DB has already been
// opened against a synthetic on-disk SQLite — the network
// download/verification path is short-circuited.
func newServiceWithSeed(t *testing.T) *Service {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, dbFileName)
	seedDB(t, dbPath)

	h := host.New()
	h.AppDataPath = dir
	s := New(h, nil)
	// Manually open the DB so ensureDB() short-circuits without
	// touching the network.
	db, err := openReadOnly(dbPath)
	if err != nil {
		t.Fatalf("openReadOnly: %v", err)
	}
	s.db = db
	s.inited = true
	// Windows holds an exclusive lock on the open SQLite file —
	// close before t.TempDir tries to RemoveAll.
	t.Cleanup(func() { _ = db.Close() })
	return s
}

func TestGetMetadataFromSha1s(t *testing.T) {
	s := newServiceWithSeed(t)
	rows, err := s.GetMetadataFromSha1s(context.Background(), []string{"aaa", "bbb", "missing"})
	if err != nil {
		t.Fatalf("GetMetadataFromSha1s: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("want 2 rows, got %d", len(rows))
	}
	bySha := map[string]int{}
	for i, r := range rows {
		bySha[r.Sha1] = i
	}
	if i, ok := bySha["aaa"]; !ok {
		t.Fatal("missing aaa")
	} else {
		r := rows[i]
		if r.Name != "JEI" || r.Domain != "mods" {
			t.Fatalf("bad file row: %+v", r)
		}
		if r.Forge == nil || r.Forge["id"] != "jei" || r.Forge["version"] != "11.0.0" {
			t.Fatalf("bad forge: %+v", r.Forge)
		}
		if r.Curseforge == nil {
			t.Fatal("missing curseforge attribution")
		}
		// Numeric columns surface as float64 for renderer wire-shape.
		if r.Curseforge["id"] != float64(238222) {
			t.Fatalf("bad curseforge.id: %#v", r.Curseforge["id"])
		}
		if r.Curseforge["file"] != float64(4500000) {
			t.Fatalf("bad curseforge.file: %#v", r.Curseforge["file"])
		}
	}
	if i, ok := bySha["bbb"]; !ok {
		t.Fatal("missing bbb")
	} else {
		r := rows[i]
		if r.Fabric == nil || r.Fabric["id"] != "sodium" {
			t.Fatalf("bad fabric: %+v", r.Fabric)
		}
		if r.Modrinth == nil || r.Modrinth["project"] != nil {
			// modrinth_version columns are (project, version) → wire
			// keys are (id, version) per the contract; assert that.
			if r.Modrinth["id"] != "AANobbMI" {
				t.Fatalf("bad modrinth.id: %#v", r.Modrinth["id"])
			}
		}
	}
}

func TestLookupModrinthAndCurseforgeId(t *testing.T) {
	s := newServiceWithSeed(t)
	ctx := context.Background()

	mr, err := s.LookupModrinthId(ctx, 238222)
	if err != nil || mr == nil || *mr != "jei-modrinth-id" {
		t.Fatalf("LookupModrinthId: got=%v err=%v", mr, err)
	}

	cf, err := s.LookupCurseforgeId(ctx, "AANobbMI")
	if err != nil || cf == nil || *cf != float64(394468) {
		t.Fatalf("LookupCurseforgeId: got=%v err=%v", cf, err)
	}

	// Unknown ids → nil, nil (never an error to the renderer).
	if mr, err := s.LookupModrinthId(ctx, 9999999); err != nil || mr != nil {
		t.Fatalf("LookupModrinthId(unknown): got=%v err=%v", mr, err)
	}
	if cf, err := s.LookupCurseforgeId(ctx, "nope"); err != nil || cf != nil {
		t.Fatalf("LookupCurseforgeId(unknown): got=%v err=%v", cf, err)
	}
}

func TestLookupMappingBatch(t *testing.T) {
	s := newServiceWithSeed(t)
	out, err := s.LookupMapping(context.Background(), map[string]any{
		"curseforge": []any{float64(238222), float64(394468)},
		"modrinth":   []any{"jei-modrinth-id", "AANobbMI"},
	})
	if err != nil {
		t.Fatalf("LookupMapping: %v", err)
	}
	cf, _ := out["curseforge"].(map[string]any)
	mr, _ := out["modrinth"].(map[string]any)
	if cf["238222"] != "jei-modrinth-id" {
		t.Fatalf("cf->mr: %#v", cf)
	}
	if cf["394468"] != "AANobbMI" {
		t.Fatalf("cf->mr: %#v", cf)
	}
	if mr["jei-modrinth-id"] != float64(238222) {
		t.Fatalf("mr->cf: %#v", mr)
	}
	if mr["AANobbMI"] != float64(394468) {
		t.Fatalf("mr->cf: %#v", mr)
	}
}
