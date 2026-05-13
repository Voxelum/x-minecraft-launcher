// Package projectmapping implements
// contract.ProjectMappingService.
//
// Backed by a downloaded read-only SQLite catalog hosted at
// `https://xmcl.blob.core.windows.net/project-mapping/<locale>.sqlite`
// (with an adjacent `.sha256` integrity file and a gzipped variant
// at `<…>.sqlite.gz`). The renderer uses it to cross-link Modrinth
// projects with their CurseForge counterpart and to surface the
// localised name + description in the search dropdown.
//
// Lazy init: first method call kicks the download. The locale is
// taken off the persisted Settings store; if the renderer flips the
// locale at runtime we reopen the DB on the next call. We always
// fall back to the `en` blob when the requested locale isn't
// published — the upstream layout matches that exact fallback.
//
// Errors are swallowed and logged; every callable returns empty
// results when the DB isn't reachable so the renderer's market UI
// stays responsive instead of erroring.
package projectmapping

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
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
)

const (
	// urlBase is the upstream root. The TS reference reads from
	// `xmcl.blob.core.windows.net/project-mapping/<locale>.sqlite`;
	// we keep the same convention so the same blob serves both.
	urlBase = "https://xmcl.blob.core.windows.net/project-mapping"

	// fallbackLocale is the lowest-common-denominator file the
	// upstream always publishes.
	fallbackLocale = "en"
)

// Service implements contract.ProjectMappingService.
type Service struct {
	contract.ProjectMappingServiceNotImplemented

	host *host.Host

	mu sync.Mutex
	// cache of the open DB; reopened transparently when the
	// renderer flips the locale at runtime.
	cached *cachedDB
}

type cachedDB struct {
	locale string
	db     *sql.DB
	path   string
}

// New constructs a ProjectMappingService.
func New(h *host.Host, _ *bridge.StateManager) *Service {
	return &Service{host: h}
}

var _ contract.ProjectMappingService = (*Service)(nil)

// ============================================================
// Contract methods
// ============================================================

// LookupByModrinth returns the (modrinthId, curseforgeId, name,
// description) tuple for the given Modrinth project, or nil when
// the catalog has no row.
func (s *Service) LookupByModrinth(ctx context.Context, modrinth string) (*contract.ProjectMapping, error) {
	if modrinth == "" {
		return nil, nil
	}
	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		return nil, nil
	}
	row := db.QueryRowContext(ctx,
		`SELECT modrinthId, curseforgeId, name, description FROM project WHERE modrinthId = ? LIMIT 1`,
		modrinth,
	)
	return scanRow(row)
}

// LookupByCurseforge returns the mapping for the given CurseForge
// project id (input is float per the contract / TS `number`).
func (s *Service) LookupByCurseforge(ctx context.Context, curseforge float64) (*contract.ProjectMapping, error) {
	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		return nil, nil
	}
	row := db.QueryRowContext(ctx,
		`SELECT modrinthId, curseforgeId, name, description FROM project WHERE curseforgeId = ? LIMIT 1`,
		int64(curseforge),
	)
	return scanRow(row)
}

// LookupByKeyword does a `name LIKE %?% OR description LIKE %?%`
// search. Empty keyword returns nothing.
func (s *Service) LookupByKeyword(ctx context.Context, keyword string) ([]contract.ProjectMapping, error) {
	if strings.TrimSpace(keyword) == "" {
		return []contract.ProjectMapping{}, nil
	}
	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		return []contract.ProjectMapping{}, nil
	}
	pattern := "%" + keyword + "%"
	rows, err := db.QueryContext(ctx,
		`SELECT modrinthId, curseforgeId, name, description FROM project WHERE name LIKE ? OR description LIKE ?`,
		pattern, pattern,
	)
	if err != nil {
		return []contract.ProjectMapping{}, nil
	}
	defer rows.Close()
	return scanRows(rows), nil
}

// LookupBatch resolves both a list of Modrinth ids and a list of
// CurseForge ids in one query (matches the TS reference).
func (s *Service) LookupBatch(ctx context.Context, modrinth []string, curseforge []float64) ([]contract.ProjectMapping, error) {
	if len(modrinth) == 0 && len(curseforge) == 0 {
		return []contract.ProjectMapping{}, nil
	}
	db, err := s.ensureDB(ctx)
	if err != nil || db == nil {
		return []contract.ProjectMapping{}, nil
	}

	var (
		clauses []string
		args    []any
	)
	if len(modrinth) > 0 {
		ph := make([]string, len(modrinth))
		for i, v := range modrinth {
			ph[i] = "?"
			args = append(args, v)
		}
		clauses = append(clauses, "modrinthId IN ("+strings.Join(ph, ",")+")")
	}
	if len(curseforge) > 0 {
		ph := make([]string, len(curseforge))
		for i, v := range curseforge {
			ph[i] = "?"
			args = append(args, int64(v))
		}
		clauses = append(clauses, "curseforgeId IN ("+strings.Join(ph, ",")+")")
	}
	query := `SELECT modrinthId, curseforgeId, name, description FROM project WHERE ` +
		strings.Join(clauses, " OR ")
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return []contract.ProjectMapping{}, nil
	}
	defer rows.Close()
	return scanRows(rows), nil
}

// ============================================================
// DB lifecycle
// ============================================================

// ensureDB returns the (re)opened DB for the renderer's current
// locale. Holds the service mutex while reopening so concurrent
// callers don't race on the locale flip.
func (s *Service) ensureDB(ctx context.Context) (*sql.DB, error) {
	locale := s.currentLocale()

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cached != nil && s.cached.locale == locale {
		return s.cached.db, nil
	}

	if err := s.host.Mutex.With("projectmapping:ensure:"+locale, func() error {
		return s.fetchAndVerify(ctx, locale)
	}); err != nil {
		s.warn("ensureDB: fetch", "locale", locale, "err", err)
		// Don't bail — there might be a cached file from a previous
		// run that's still queryable.
	}

	path := filepath.Join(s.host.AppDataPath, "project-mapping-"+locale+".sqlite")
	if _, err := os.Stat(path); err != nil {
		// Try the en fallback path on disk.
		fallback := filepath.Join(s.host.AppDataPath, "project-mapping-"+fallbackLocale+".sqlite")
		if _, err := os.Stat(fallback); err == nil {
			path = fallback
			locale = fallbackLocale
		} else {
			return nil, nil
		}
	}

	db, err := openReadOnly(path)
	if err != nil {
		s.warn("ensureDB: open", "path", path, "err", err)
		return nil, nil
	}
	if s.cached != nil && s.cached.db != nil {
		_ = s.cached.db.Close()
	}
	s.cached = &cachedDB{locale: locale, db: db, path: path}
	return db, nil
}

// fetchAndVerify ensures the on-disk DB for `locale` matches the
// upstream sha256, downloading the gzipped blob and verifying after
// gunzip. Falls back to the `en` blob when the requested locale
// isn't published.
func (s *Service) fetchAndVerify(ctx context.Context, locale string) error {
	if err := s.fetchOne(ctx, locale); err == nil {
		return nil
	}
	if locale == fallbackLocale {
		return errors.New("projectmapping: en blob unavailable")
	}
	// Try the en fallback.
	return s.fetchOne(ctx, fallbackLocale)
}

// fetchOne handles the per-locale download: probe the `.sha256`,
// reuse the on-disk file when it already matches, otherwise pull
// the gzipped blob, gunzip into memory, sha256-verify, and
// atomically write to disk.
func (s *Service) fetchOne(ctx context.Context, locale string) error {
	dbURL := urlBase + "/" + locale + ".sqlite"
	dbPath := filepath.Join(s.host.AppDataPath, "project-mapping-"+locale+".sqlite")

	expected, err := s.fetchText(ctx, dbURL+".sha256")
	if err != nil {
		// No sha — keep whatever's already on disk.
		if _, statErr := os.Stat(dbPath); statErr == nil {
			return nil
		}
		return err
	}
	expected = strings.ToLower(strings.TrimSpace(expected))
	if expected == "" {
		return errors.New("projectmapping: empty sha256")
	}

	if ok, _ := verifySHA256(dbPath, expected); ok {
		return nil
	}

	// Pull the gzipped blob into memory; project-mapping DBs are
	// small (~MiBs once unzipped) so a one-shot read is fine and
	// avoids a temp file dance.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, dbURL+".gz", nil)
	if err != nil {
		return err
	}
	resp, err := s.host.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("projectmapping: %s: %s", dbURL+".gz", resp.Status)
	}
	zr, err := gzip.NewReader(resp.Body)
	if err != nil {
		return fmt.Errorf("projectmapping: gunzip: %w", err)
	}
	defer zr.Close()

	data, err := io.ReadAll(zr)
	if err != nil {
		return fmt.Errorf("projectmapping: read body: %w", err)
	}

	hash := sha256.Sum256(data)
	if !strings.EqualFold(hex.EncodeToString(hash[:]), expected) {
		return errors.New("projectmapping: sha256 mismatch after gunzip")
	}

	// Atomic write: write to `<path>.part`, then rename.
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return err
	}
	tmp := dbPath + ".part"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, dbPath)
}

// fetchText issues a GET and returns the response body as a string.
func (s *Service) fetchText(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	resp, err := s.host.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("projectmapping: %s: %s", url, resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// currentLocale returns the renderer's persisted locale, defaulting
// to `en` when the settings store isn't online yet.
func (s *Service) currentLocale() string {
	store, ok := host.Get[*host.SettingsStore[contract.Settings]](s.host.Registry)
	if !ok || store == nil {
		return fallbackLocale
	}
	loc := strings.ToLower(strings.TrimSpace(store.Get().Locale))
	if loc == "" {
		return fallbackLocale
	}
	return loc
}

func (s *Service) warn(msg string, kv ...any) {
	if s.host != nil && s.host.Logger != nil {
		s.host.Logger.Warn("projectmapping: "+msg, kv...)
	}
}

// ============================================================
// Helpers
// ============================================================

// scanRow decodes a single result row into a *ProjectMapping. Returns
// (nil, nil) on `sql.ErrNoRows`; (nil, nil) on other scan errors so
// the caller's contract surface stays clean.
func scanRow(row *sql.Row) (*contract.ProjectMapping, error) {
	var (
		mr    string
		cf    int64
		name  sql.NullString
		desc  sql.NullString
		pm    contract.ProjectMapping
		empty contract.ProjectMapping
	)
	if err := row.Scan(&mr, &cf, &name, &desc); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, nil
	}
	pm = contract.ProjectMapping{
		ModrinthId:   mr,
		CurseforgeId: float64(cf),
		Name:         name.String,
		Description:  desc.String,
	}
	if pm == empty {
		return nil, nil
	}
	return &pm, nil
}

// scanRows decodes every result row into a `[]ProjectMapping`,
// dropping rows that fail to scan.
func scanRows(rows *sql.Rows) []contract.ProjectMapping {
	var out []contract.ProjectMapping
	for rows.Next() {
		var (
			mr   string
			cf   int64
			name sql.NullString
			desc sql.NullString
		)
		if err := rows.Scan(&mr, &cf, &name, &desc); err != nil {
			continue
		}
		out = append(out, contract.ProjectMapping{
			ModrinthId:   mr,
			CurseforgeId: float64(cf),
			Name:         name.String,
			Description:  desc.String,
		})
	}
	if out == nil {
		return []contract.ProjectMapping{}
	}
	return out
}

// openReadOnly opens the SQLite file at `path` in read-only mode.
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

// verifySHA256 streams the file at `path` through sha256 and reports
// (true, nil) on a match. (false, nil) for a missing file.
func verifySHA256(path, expected string) (bool, error) {
	f, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return false, err
	}
	return strings.EqualFold(hex.EncodeToString(h.Sum(nil)), expected), nil
}
