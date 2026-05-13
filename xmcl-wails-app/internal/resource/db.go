// db.go — DB-level CRUD for the resource catalogue. Every method
// here accepts a *sql.DB or *sql.Tx (via dbConn). The high-level
// orchestration (parse → upsert → push to renderer) lives in
// manager.go.

package resource

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// dbConn lets callers share code between *sql.DB and *sql.Tx.
type dbConn interface {
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
}

// ensureSchema applies schemaSQL inside a single transaction. Safe
// to call repeatedly; every statement is `CREATE … IF NOT EXISTS`.
func ensureSchema(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("resource: begin: %w", err)
	}
	defer tx.Rollback()
	for _, stmt := range strings.Split(schemaSQL, ";") {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("resource: schema: %w (sql=%s)", err, stmt)
		}
	}
	return tx.Commit()
}

// ============================================================
// Snapshot CRUD
// ============================================================

// upsertSnapshot writes (or replaces) a single snapshot row.
func upsertSnapshot(db dbConn, s Snapshot) error {
	const q = `
INSERT INTO snapshots (domainedPath, ino, mtime, fileType, sha1)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(domainedPath) DO UPDATE SET
    ino      = excluded.ino,
    mtime    = excluded.mtime,
    fileType = excluded.fileType,
    sha1     = excluded.sha1
`
	_, err := db.Exec(q, s.DomainedPath, s.Ino, s.Mtime, string(s.FileType), s.SHA1)
	return err
}

// deleteSnapshot drops a snapshot row by its primary key. Missing
// rows are silently ignored.
func deleteSnapshot(db dbConn, domainedPath string) error {
	_, err := db.Exec(`DELETE FROM snapshots WHERE domainedPath = ?`, domainedPath)
	return err
}

// snapshotByPath fetches a snapshot row by its primary key. Returns
// (nil, nil) when the row is absent.
func snapshotByPath(db dbConn, domainedPath string) (*Snapshot, error) {
	row := db.QueryRow(`
SELECT domainedPath, ino, mtime, fileType, sha1
  FROM snapshots WHERE domainedPath = ?`, domainedPath)
	return scanSnapshot(row)
}

// snapshotsUnderDomain returns every snapshot whose domainedPath is
// rooted at the given prefix (typically a domain name like "mods").
func snapshotsUnderDomain(db dbConn, prefix string) ([]Snapshot, error) {
	if !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}
	rows, err := db.Query(`
SELECT domainedPath, ino, mtime, fileType, sha1
  FROM snapshots WHERE domainedPath LIKE ? || '%'`, prefix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Snapshot
	for rows.Next() {
		s, err := scanSnapshot(rows)
		if err != nil {
			return nil, err
		}
		if s != nil {
			out = append(out, *s)
		}
	}
	return out, rows.Err()
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSnapshot(r rowScanner) (*Snapshot, error) {
	var s Snapshot
	var ft string
	if err := r.Scan(&s.DomainedPath, &s.Ino, &s.Mtime, &ft, &s.SHA1); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	s.FileType = FileType(ft)
	return &s, nil
}

// ============================================================
// Resource CRUD (the metadata catalogue)
// ============================================================

// upsertResource writes the metadata blob for a sha1. The metadata
// map is split across the per-domain JSON columns; unrecognised
// keys are dropped.
//
// `name` may be empty — it's separated out because the renderer's
// search uses it (we LIKE-match on it).
func upsertResource(db dbConn, sha1, name, sha256 string, metadata map[string]any) error {
	cols := []string{"sha1", "name"}
	args := []any{sha1, name}
	if sha256 != "" {
		cols = append(cols, "sha256")
		args = append(args, sha256)
	}
	for _, key := range metadataColumns {
		v, ok := metadata[key]
		if !ok || v == nil {
			continue
		}
		raw, err := json.Marshal(v)
		if err != nil {
			continue
		}
		cols = append(cols, key)
		args = append(args, string(raw))
	}
	placeholders := strings.Repeat("?,", len(cols))
	placeholders = placeholders[:len(placeholders)-1]
	q := "INSERT INTO resources (" + strings.Join(cols, ",") +
		") VALUES (" + placeholders + ")\n" +
		"ON CONFLICT(sha1) DO UPDATE SET "
	updates := make([]string, 0, len(cols))
	for _, c := range cols {
		if c == "sha1" {
			continue
		}
		updates = append(updates, c+" = excluded."+c)
	}
	q += strings.Join(updates, ", ")
	_, err := db.Exec(q, args...)
	return err
}

// metadataColumns is the per-domain JSON-blob set the resources
// table can carry. Mirrors `ResourceMetadata` in the contract.
var metadataColumns = []string{
	"forge", "fabric", "liteloader", "quilt", "neoforge",
	"resourcepack", "save", "shaderpack",
	"instance", "github", "curseforge", "modrinth", "gitlab",
	"mmcmodpack",
}

// upsertURIs inserts every (sha1, uri) pair, ignoring duplicates.
func upsertURIs(db dbConn, sha1 string, uris []string) error {
	for _, u := range uris {
		if u == "" {
			continue
		}
		if _, err := db.Exec(
			`INSERT OR IGNORE INTO uris (sha1, uri) VALUES (?, ?)`, sha1, u,
		); err != nil {
			return err
		}
	}
	return nil
}

// upsertIcons inserts every (sha1, icon) pair, ignoring duplicates.
func upsertIcons(db dbConn, sha1 string, icons []string) error {
	for _, ic := range icons {
		if ic == "" {
			continue
		}
		if _, err := db.Exec(
			`INSERT OR IGNORE INTO icons (sha1, icon) VALUES (?, ?)`, sha1, ic,
		); err != nil {
			return err
		}
	}
	return nil
}

// resourceBySHA1 reads back everything we have for a sha1. Returns
// (nil, nil) when the resource isn't catalogued yet.
func resourceBySHA1(db dbConn, sha1 string) (*Stored, error) {
	out, err := resourcesBySHA1s(db, []string{sha1})
	if err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, nil
	}
	v := out[0]
	return &v, nil
}

// resourcesBySHA1s batch-loads multiple sha1s in one query each.
func resourcesBySHA1s(db dbConn, sha1s []string) ([]Stored, error) {
	if len(sha1s) == 0 {
		return nil, nil
	}
	q := `SELECT sha1, name, ` + strings.Join(metadataColumns, ", ") +
		` FROM resources WHERE sha1 IN (` + placeholders(len(sha1s)) + `)`
	args := toAnyStrings(sha1s)
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Stored
	for rows.Next() {
		s, err := scanResource(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, nil
	}
	if err := attachAuxiliary(db, out); err != nil {
		return nil, err
	}
	return out, nil
}

// scanResource parses a single resources row into a Stored.
func scanResource(r rowScanner) (Stored, error) {
	values := make([]sql.NullString, len(metadataColumns))
	dest := []any{new(string), new(string)}
	for i := range values {
		dest = append(dest, &values[i])
	}
	if err := r.Scan(dest...); err != nil {
		return Stored{}, err
	}
	out := Stored{
		SHA1:     *dest[0].(*string),
		Name:     *dest[1].(*string),
		Metadata: map[string]any{},
	}
	for i, col := range metadataColumns {
		if !values[i].Valid || values[i].String == "" {
			continue
		}
		var v any
		if err := json.Unmarshal([]byte(values[i].String), &v); err != nil {
			continue
		}
		out.Metadata[col] = v
	}
	return out, nil
}

// attachAuxiliary fills the .Icons / .URIs / .Tags slices on a batch
// of Stored rows.
func attachAuxiliary(db dbConn, in []Stored) error {
	if len(in) == 0 {
		return nil
	}
	idx := make(map[string]int, len(in))
	hashes := make([]any, 0, len(in))
	for i, r := range in {
		idx[r.SHA1] = i
		hashes = append(hashes, r.SHA1)
	}
	type kv struct {
		Hash  string
		Value string
	}
	collect := func(table, col string) ([]kv, error) {
		q := `SELECT sha1, ` + col + ` FROM ` + table +
			` WHERE sha1 IN (` + placeholders(len(hashes)) + `)`
		rows, err := db.Query(q, hashes...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []kv
		for rows.Next() {
			var k kv
			if err := rows.Scan(&k.Hash, &k.Value); err != nil {
				return nil, err
			}
			out = append(out, k)
		}
		return out, rows.Err()
	}
	if rows, err := collect("icons", "icon"); err == nil {
		for _, kv := range rows {
			i := idx[kv.Hash]
			in[i].Icons = append(in[i].Icons, kv.Value)
		}
	} else {
		return err
	}
	if rows, err := collect("uris", "uri"); err == nil {
		for _, kv := range rows {
			i := idx[kv.Hash]
			in[i].URIs = append(in[i].URIs, kv.Value)
		}
	} else {
		return err
	}
	if rows, err := collect("tags", "tag"); err == nil {
		for _, kv := range rows {
			i := idx[kv.Hash]
			in[i].Tags = append(in[i].Tags, kv.Value)
		}
	} else {
		return err
	}
	return nil
}

// hashesByURIs reverses uri → sha1.
func hashesByURIs(db dbConn, uris []string) ([]string, error) {
	if len(uris) == 0 {
		return nil, nil
	}
	q := `SELECT DISTINCT sha1 FROM uris WHERE uri IN (` + placeholders(len(uris)) + `)`
	rows, err := db.Query(q, toAnyStrings(uris)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// searchResourcesByName runs a case-insensitive LIKE over the
// resources.name column, optionally restricted to a domain prefix
// (matched against the snapshots table).
func searchResourcesByName(db dbConn, keyword string, domain Domain) ([]Stored, error) {
	pattern := "%" + escapeLike(keyword) + "%"
	var (
		rows *sql.Rows
		err  error
	)
	if domain == "" {
		rows, err = db.Query(`
SELECT sha1, name, `+strings.Join(metadataColumns, ", ")+`
  FROM resources WHERE name LIKE ? ESCAPE '\' COLLATE NOCASE`, pattern)
	} else {
		rows, err = db.Query(`
SELECT r.sha1, r.name, `+joinPrefix("r.", metadataColumns)+`
  FROM resources r
  JOIN snapshots s ON s.sha1 = r.sha1
 WHERE s.domainedPath LIKE ? || '%'
   AND r.name LIKE ? ESCAPE '\' COLLATE NOCASE`,
			string(domain)+"/", pattern)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Stored
	for rows.Next() {
		s, err := scanResource(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := attachAuxiliary(db, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ============================================================
// Helpers
// ============================================================

func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.TrimRight(strings.Repeat("?,", n), ",")
}

func toAnyStrings(in []string) []any {
	out := make([]any, len(in))
	for i, s := range in {
		out[i] = s
	}
	return out
}

func joinPrefix(prefix string, in []string) string {
	out := make([]string, len(in))
	for i, s := range in {
		out[i] = prefix + s
	}
	return strings.Join(out, ", ")
}

// escapeLike escapes the LIKE wildcards (`%`, `_`, `\`) so a user
// keyword can't accidentally globbify the search.
func escapeLike(s string) string {
	r := strings.NewReplacer(
		`\`, `\\`,
		`%`, `\%`,
		`_`, `\_`,
	)
	return r.Replace(s)
}
