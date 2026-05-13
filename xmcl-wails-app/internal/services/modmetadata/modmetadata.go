// Package modmetadata implements contract.ModMetadataService.
//
// Backed by a downloaded read-only SQLite blob hosted at
// `https://xmcl.blob.core.windows.net/releases/db.sqlite` (with an
// adjacent `.sha1` integrity file). The DB carries per-file mod
// attribution that drives the renderer's "decorate resources" path:
// hash → human-readable name + per-loader mod ids + Modrinth /
// CurseForge project pointers.
//
// On first use we:
//
//  1. Fetch the `.sha1` (small text file).
//  2. If `<appData>/db.sqlite` already matches, reuse it.
//  3. Otherwise `network.Client.Download` the blob (the network
//     client transparently fans out into Range segments for the
//     larger payload, sha1-verifies, atomic renames into place).
//  4. Open the file with `modernc.org/sqlite` in read-only mode and
//     keep the `*sql.DB` handle for the process lifetime.
//
// All five contract methods accept the renderer's loose JSON shapes
// and surface the same loose shape back — every callable returns
// empty results (never an error) when the DB isn't reachable, so the
// renderer's "decorate" path silently degrades to "no extra metadata"
// without breaking the resource list.
package modmetadata

import (
	"context"
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	_ "modernc.org/sqlite" // register the "sqlite" driver

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/network"
)

const (
	dbFileName = "db.sqlite"
	dbURL      = "https://xmcl.blob.core.windows.net/releases/db.sqlite"
	sha1URL    = "https://xmcl.blob.core.windows.net/releases/db.sqlite.sha1"
)

// Service implements contract.ModMetadataService.
type Service struct {
	contract.ModMetadataServiceNotImplemented

	host *host.Host

	mu      sync.Mutex
	db      *sql.DB
	dbPath  string
	initErr error
	inited  bool
}

// New constructs a ModMetadataService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{
		host:   h,
		dbPath: filepath.Join(h.AppDataPath, dbFileName),
	}
}

var _ contract.ModMetadataService = (*Service)(nil)

// ============================================================
// Contract methods
// ============================================================

// GetMetadataFromSha1 returns the metadata row for `sha1`, or nil
// when no row exists. Returns nil + nil when the DB isn't ready.
func (s *Service) GetMetadataFromSha1(ctx context.Context, sha1 string) (*contract.ModMetadata, error) {
	if sha1 == "" {
		return nil, nil
	}
	rows, err := s.GetMetadataFromSha1s(ctx, []string{sha1})
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	r := rows[0]
	return &r, nil
}

// GetMetadataFromSha1s batch-loads rows for the given hashes. Hashes
// without a row are silently dropped (mirrors the TS reference).
func (s *Service) GetMetadataFromSha1s(ctx context.Context, hashes []string) ([]contract.ModMetadata, error) {
	if len(hashes) == 0 {
		return []contract.ModMetadata{}, nil
	}
	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		s.warn("GetMetadataFromSha1s: db unavailable", "err", err)
		return []contract.ModMetadata{}, nil
	}

	files, err := s.queryFiles(ctx, db, hashes)
	if err != nil {
		return []contract.ModMetadata{}, nil
	}
	if len(files) == 0 {
		return []contract.ModMetadata{}, nil
	}

	keys := make([]string, 0, len(files))
	for k := range files {
		keys = append(keys, k)
	}
	forge, _ := s.queryAttribution(ctx, db, "forge_mod", "id", "version", keys)
	fabric, _ := s.queryAttribution(ctx, db, "fabric_mod", "id", "version", keys)
	modrinth, _ := s.queryAttribution(ctx, db, "modrinth_version", "project", "version", keys)
	curseforge, _ := s.queryAttribution(ctx, db, "curseforge_file", "project", "file", keys)

	out := make([]contract.ModMetadata, 0, len(files))
	for _, f := range files {
		md := contract.ModMetadata{
			Sha1:   f.sha1,
			Name:   f.name,
			Domain: f.domain,
		}
		if v, ok := forge[f.sha1]; ok {
			md.Forge = map[string]any{"id": v.a, "version": v.b}
		}
		if v, ok := fabric[f.sha1]; ok {
			md.Fabric = map[string]any{"id": v.a, "version": v.b}
		}
		if v, ok := modrinth[f.sha1]; ok {
			md.Modrinth = map[string]any{"id": v.a, "version": v.b}
		}
		if v, ok := curseforge[f.sha1]; ok {
			// curseforge_file.project / .file are integers in the
			// upstream schema; surface them as `float64` so the
			// renderer's `id: number` typing resolves on the wire.
			md.Curseforge = map[string]any{"id": toFloat(v.a), "file": toFloat(v.b)}
		}
		out = append(out, md)
	}
	return out, nil
}

// LookupModrinthId resolves a CurseForge project id to its Modrinth
// counterpart, when known. The contract takes the input as a float
// (TS `number`); the on-disk column is integer.
func (s *Service) LookupModrinthId(ctx context.Context, curseforgeId float64) (*string, error) {
	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		return nil, nil
	}
	row := db.QueryRowContext(ctx,
		`SELECT modrinth_project FROM project_mapping WHERE curseforge_project = ? LIMIT 1`,
		int64(curseforgeId),
	)
	var v string
	switch err := row.Scan(&v); err {
	case nil:
		return &v, nil
	case sql.ErrNoRows:
		return nil, nil
	default:
		return nil, nil
	}
}

// LookupCurseforgeId resolves a Modrinth project id to its
// CurseForge counterpart, when known.
func (s *Service) LookupCurseforgeId(ctx context.Context, modrinthId string) (*float64, error) {
	if modrinthId == "" {
		return nil, nil
	}
	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		return nil, nil
	}
	row := db.QueryRowContext(ctx,
		`SELECT curseforge_project FROM project_mapping WHERE modrinth_project = ? LIMIT 1`,
		modrinthId,
	)
	var v int64
	switch err := row.Scan(&v); err {
	case nil:
		f := float64(v)
		return &f, nil
	case sql.ErrNoRows:
		return nil, nil
	default:
		return nil, nil
	}
}

// LookupMapping batch-resolves both directions. The wire payload is
// the renderer's `{ curseforge: number[], modrinth: string[] }`
// shape; the response carries `{ curseforge: { <cf>: <mr> },
// modrinth: { <mr>: <cf> } }` (mirrors the TS reference precisely).
func (s *Service) LookupMapping(ctx context.Context, lookup map[string]any) (map[string]any, error) {
	cfIDs := extractInts(lookup, "curseforge")
	mrIDs := extractStrings(lookup, "modrinth")
	out := map[string]any{
		"curseforge": map[string]any{},
		"modrinth":   map[string]any{},
	}

	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		return out, nil
	}

	if len(cfIDs) > 0 {
		query, args := buildInClause(
			`SELECT curseforge_project, modrinth_project FROM project_mapping WHERE curseforge_project IN`,
			intArgs(cfIDs),
		)
		rows, err := db.QueryContext(ctx, query, args...)
		if err == nil {
			cfMap := map[string]any{}
			for rows.Next() {
				var cf int64
				var mr string
				if err := rows.Scan(&cf, &mr); err == nil {
					cfMap[fmt.Sprintf("%d", cf)] = mr
				}
			}
			rows.Close()
			out["curseforge"] = cfMap
		}
	}

	if len(mrIDs) > 0 {
		query, args := buildInClause(
			`SELECT curseforge_project, modrinth_project FROM project_mapping WHERE modrinth_project IN`,
			stringArgs(mrIDs),
		)
		rows, err := db.QueryContext(ctx, query, args...)
		if err == nil {
			mrMap := map[string]any{}
			for rows.Next() {
				var cf int64
				var mr string
				if err := rows.Scan(&cf, &mr); err == nil {
					mrMap[mr] = float64(cf)
				}
			}
			rows.Close()
			out["modrinth"] = mrMap
		}
	}

	return out, nil
}

// ============================================================
// DB lifecycle
// ============================================================

// fileRow is the minimal projection of the `file` table.
type fileRow struct {
	sha1   string
	name   string
	domain string
}

func (s *Service) queryFiles(ctx context.Context, db *sql.DB, hashes []string) (map[string]fileRow, error) {
	query, args := buildInClause(
		`SELECT sha1, name, domain FROM file WHERE sha1 IN`,
		stringArgs(hashes),
	)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]fileRow{}
	for rows.Next() {
		var r fileRow
		if err := rows.Scan(&r.sha1, &r.name, &r.domain); err == nil {
			out[r.sha1] = r
		}
	}
	return out, nil
}

// pair carries the two attribution columns for one of the loader
// tables (`forge_mod` / `fabric_mod` / `modrinth_version` /
// `curseforge_file`). Both are decoded as `any` (string OR int64)
// so the same helper handles every table.
type pair struct {
	a any
	b any
}

// queryAttribution fetches `(<keyCol>, <colA>, <colB>)` rows from
// `<table>` where the sha1 matches one of `hashes`. The result is
// keyed by sha1 — only one row per hash is preserved (the schema
// promises one anyway).
func (s *Service) queryAttribution(ctx context.Context, db *sql.DB, table, colA, colB string, hashes []string) (map[string]pair, error) {
	if len(hashes) == 0 {
		return map[string]pair{}, nil
	}
	query, args := buildInClause(
		fmt.Sprintf(`SELECT sha1, %s, %s FROM %s WHERE sha1 IN`, colA, colB, table),
		stringArgs(hashes),
	)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]pair{}
	for rows.Next() {
		var sha string
		var a, b any
		if err := rows.Scan(&sha, &a, &b); err == nil {
			out[sha] = pair{a: a, b: b}
		}
	}
	return out, nil
}

// ensureDB opens the SQLite handle, downloading + verifying the blob
// on first use. Subsequent calls reuse the cached handle. Returns
// (nil, nil) when the DB couldn't be made ready (network outage,
// integrity failure) — callers degrade to "no metadata" in that
// case, never an error to the renderer.
func (s *Service) ensureDB(ctx context.Context) (*sql.DB, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.db != nil {
		return s.db, nil
	}

	if err := s.host.Mutex.With("modmetadata:ensure", func() error {
		return s.fetchAndVerify(ctx)
	}); err != nil {
		s.initErr = err
		s.warn("ensureDB: fetch+verify", "err", err)
		return nil, nil
	}

	db, err := openReadOnly(s.dbPath)
	if err != nil {
		s.initErr = err
		s.warn("ensureDB: open", "err", err)
		return nil, nil
	}
	s.db = db
	s.inited = true
	return db, nil
}

// fetchAndVerify ensures the on-disk DB matches the upstream sha1.
// Re-downloads via `network.Client.Download` (with `ExpectedSHA1` set
// from the upstream `.sha1` text file) when the local copy is stale,
// missing, or corrupt.
func (s *Service) fetchAndVerify(ctx context.Context) error {
	expected, err := s.fetchSHA1(ctx)
	if err != nil {
		// No sha1 available — fall back to whatever we already have
		// on disk. If that's missing too, return the network error.
		if _, statErr := os.Stat(s.dbPath); statErr == nil {
			return nil
		}
		return err
	}

	if ok, _ := verifyDBSha1(s.dbPath, expected); ok {
		return nil
	}

	return s.host.HTTP.Download(ctx, network.DownloadOptions{
		URLs:         []string{dbURL},
		Destination:  s.dbPath,
		ExpectedSHA1: expected,
		// db.sqlite is on the order of tens of MiB — let the
		// segmented downloader's auto path kick in.
	})
}

// fetchSHA1 issues a single GET against the `.sha1` URL and returns
// the trimmed hash string.
func (s *Service) fetchSHA1(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sha1URL, nil)
	if err != nil {
		return "", err
	}
	resp, err := s.host.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("modmetadata: sha1 fetch: %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return strings.ToLower(strings.TrimSpace(string(body))), nil
}

// ============================================================
// Tiny helpers
// ============================================================

// openReadOnly opens the SQLite file at `path` in read-only mode.
// Single connection avoids the modernc driver's serialisation lock
// surprise.
func openReadOnly(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}
	dsn := "file:" + path + "?mode=ro&_pragma=busy_timeout(2000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func (s *Service) warn(msg string, kv ...any) {
	if s.host != nil && s.host.Logger != nil {
		s.host.Logger.Warn("modmetadata: "+msg, kv...)
	}
}

// buildInClause renders an `IN (?, ?, …)` clause and returns the
// matching `[]any` driver args. `args` carries the typed values; the
// caller's prefix should already include `… IN`.
func buildInClause(prefix string, args []any) (string, []any) {
	if len(args) == 0 {
		return prefix + " (NULL)", nil
	}
	var b strings.Builder
	b.WriteString(prefix)
	b.WriteString(" (")
	for i := range args {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString("?")
	}
	b.WriteString(")")
	return b.String(), args
}

func stringArgs(in []string) []any {
	out := make([]any, len(in))
	for i, v := range in {
		out[i] = v
	}
	return out
}

func intArgs(in []int64) []any {
	out := make([]any, len(in))
	for i, v := range in {
		out[i] = v
	}
	return out
}

// extractInts pulls a `[]int64` out of `lookup[key]` regardless of
// whether the renderer sent integers or floats (`json.Unmarshal`
// produces `float64`s by default for untyped numeric arrays).
func extractInts(lookup map[string]any, key string) []int64 {
	raw, ok := lookup[key].([]any)
	if !ok {
		return nil
	}
	out := make([]int64, 0, len(raw))
	for _, v := range raw {
		switch x := v.(type) {
		case float64:
			out = append(out, int64(x))
		case int64:
			out = append(out, x)
		case int:
			out = append(out, int64(x))
		}
	}
	return out
}

func extractStrings(lookup map[string]any, key string) []string {
	raw, ok := lookup[key].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// toFloat coerces sql `int64` (modernc returns ints as int64) into
// `float64` for the `map[string]any` wire shape.
func toFloat(v any) any {
	switch x := v.(type) {
	case int64:
		return float64(x)
	case int:
		return float64(x)
	case float64:
		return x
	default:
		return v
	}
}

// verifyDBSha1 streams the file at `path` through sha1 and returns
// (true, nil) on a match. (false, nil) on a missing file; (false,
// err) on read errors.
func verifyDBSha1(path, expected string) (bool, error) {
	f, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	defer f.Close()
	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return false, err
	}
	return strings.EqualFold(hex.EncodeToString(h.Sum(nil)), expected), nil
}
