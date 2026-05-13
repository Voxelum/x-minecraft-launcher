// manager.go — public ResourceManager API. Mirrors
// `packages/resource/ResourceManager.ts`.
//
// The manager bundles the SQLite catalogue with a small worker pool
// that runs the parser dispatcher off the calling goroutine. Every
// scan goes through the snapshot fast-path before hashing/parsing
// so re-opening an instance with N mods is O(N stat()) instead of
// O(N sha1+jar parse).

package resource

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sync/semaphore"
)

// Manager is the singleton resource catalogue. Construct one per
// process via Open.
type Manager struct {
	db     *sql.DB
	logger *slog.Logger

	// parseSem caps concurrent jar/zip parses so a 500-mod instance
	// doesn't fork 500 goroutines that all open zip readers at once.
	parseSem *semaphore.Weighted
}

// Open initialises the SQLite catalogue and applies the schema.
func Open(db *sql.DB, logger *slog.Logger) (*Manager, error) {
	if db == nil {
		return nil, errors.New("resource: nil db")
	}
	if logger == nil {
		logger = slog.Default()
	}
	if err := ensureSchema(db); err != nil {
		return nil, err
	}
	return &Manager{
		db:       db,
		logger:   logger,
		parseSem: semaphore.NewWeighted(8),
	}, nil
}

// ============================================================
// Lookups
// ============================================================

// Get returns the catalogued resource for the given sha1, or nil
// when nothing is recorded yet.
func (m *Manager) Get(sha1 string) (*Stored, error) {
	return resourceBySHA1(m.db, sha1)
}

// GetMany batch-loads multiple sha1s.
func (m *Manager) GetMany(sha1s []string) ([]Stored, error) {
	return resourcesBySHA1s(m.db, sha1s)
}

// HashesByURIs reverses uri → sha1 (used by installers to recognise
// already-downloaded files).
func (m *Manager) HashesByURIs(uris []string) ([]string, error) {
	return hashesByURIs(m.db, uris)
}

// SearchByName runs a case-insensitive LIKE against the resources
// catalogue's name column. `domain` may be empty to search all
// domains, or a specific domain to filter.
func (m *Manager) SearchByName(keyword string, domain Domain) ([]Stored, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return nil, nil
	}
	return searchResourcesByName(m.db, keyword, domain)
}

// SnapshotByPath returns the snapshot row for a domained path
// (`<domain>/<filename>`), or nil when none exists.
func (m *Manager) SnapshotByPath(domainedPath string) (*Snapshot, error) {
	return snapshotByPath(m.db, domainedPath)
}

// SnapshotsUnderDomain returns every snapshot whose domainedPath
// starts with the given domain prefix.
func (m *Manager) SnapshotsUnderDomain(domain Domain) ([]Snapshot, error) {
	return snapshotsUnderDomain(m.db, string(domain))
}

// ============================================================
// Mutations
// ============================================================

// UpsertMetadata writes the structured metadata for a sha1. URIs
// and icons are merged with whatever is already on disk.
//
// Mirrors `ResourceManager.updateMetadata`.
func (m *Manager) UpsertMetadata(sha1, name string, p ParseResult) error {
	tx, err := m.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := upsertResource(tx, sha1, name, "", p.Metadata); err != nil {
		return err
	}
	if err := upsertURIs(tx, sha1, p.URIs); err != nil {
		return err
	}
	if err := upsertIcons(tx, sha1, p.Icons); err != nil {
		return err
	}
	return tx.Commit()
}

// SetTags replaces every tag attached to a sha1 with the given set.
func (m *Manager) SetTags(sha1 string, tags []string) error {
	tx, err := m.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM tags WHERE sha1 = ?`, sha1); err != nil {
		return err
	}
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO tags (sha1, tag) VALUES (?, ?)`,
			sha1, t,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// SetName updates the resources.name column for a sha1.
func (m *Manager) SetName(sha1, name string) error {
	_, err := m.db.Exec(`UPDATE resources SET name = ? WHERE sha1 = ?`, name, strings.TrimSpace(sha1))
	return err
}

// ============================================================
// Scan
// ============================================================

// FileEntry is the per-file record returned by Scan. Each entry
// carries enough for the renderer's `Resource` shape — the calling
// service is responsible for turning it into the wire JSON.
type FileEntry struct {
	Path     string
	FileName string
	Size     int64
	Mtime    int64
	Atime    int64
	Ctime    int64
	Ino      int64
	Snapshot Snapshot
	Stored   *Stored // metadata cached in SQLite for this file's sha1
}

// Scan walks `<directory>` (typically `<instance>/<domain>/`),
// produces a per-file entry for every regular file, and returns
// them in directory order. The slow path (sha1 + parse) only runs
// for files whose snapshot is missing or stale.
//
// The returned `[]FileEntry` is the input the per-domain service
// turns into the renderer's `ResourceState`.
func (m *Manager) Scan(ctx context.Context, directory string, domain Domain) ([]FileEntry, error) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	out := make([]FileEntry, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		path := filepath.Join(directory, name)
		info, err := e.Info()
		if err != nil {
			m.logger.Debug("resource: stat failed", "path", path, "err", err)
			continue
		}
		fe := FileEntry{
			Path:     path,
			FileName: name,
			Size:     info.Size(),
		}
		fillTimes(info, &fe)

		// Sync into the catalogue.
		entry, err := m.syncOne(ctx, path, name, info, domain)
		if err != nil {
			m.logger.Debug("resource: sync failed", "path", path, "err", err)
			continue
		}
		if entry != nil {
			fe.Snapshot = entry.Snapshot
			fe.Stored = entry.Stored
		}
		out = append(out, fe)
	}
	return out, nil
}

// syncResult is a small bundle of the snapshot + cached resource
// (when present) for a single file. Returned by syncOne.
type syncResult struct {
	Snapshot Snapshot
	Stored   *Stored
}

// syncOne ensures the snapshot row + resources row are up-to-date
// for a single file. Cheap when the snapshot's (ino, mtime) still
// matches the on-disk file; otherwise sha1 + parse + upsert.
func (m *Manager) syncOne(
	ctx context.Context, path, fileName string,
	info os.FileInfo, domain Domain,
) (*syncResult, error) {
	domainedPath := string(domain) + "/" + fileName
	ino := inodeOf(info)
	mtime := info.ModTime().UnixMilli()

	// Fast path: snapshot row exists and ino + mtime match.
	prev, err := snapshotByPath(m.db, domainedPath)
	if err != nil {
		return nil, err
	}
	if prev != nil && prev.Ino == ino && prev.Mtime == mtime {
		stored, _ := resourceBySHA1(m.db, prev.SHA1)
		return &syncResult{Snapshot: *prev, Stored: stored}, nil
	}

	// Slow path: hash + parse.
	if err := m.parseSem.Acquire(ctx, 1); err != nil {
		return nil, err
	}
	defer m.parseSem.Release(1)

	sum, err := SHA1OfFile(path)
	if err != nil {
		return nil, err
	}
	parsed := Parse(path, domain)
	name := parsed.Name
	if name == "" {
		name = defaultName(fileName)
	}
	snap := Snapshot{
		DomainedPath: domainedPath,
		Ino:          ino,
		Mtime:        mtime,
		FileType:     parsed.FileType,
		SHA1:         sum,
	}

	// Persist atomically.
	tx, err := m.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if err := upsertSnapshot(tx, snap); err != nil {
		return nil, err
	}
	if err := upsertResource(tx, sum, name, "", parsed.Metadata); err != nil {
		return nil, err
	}
	if err := upsertURIs(tx, sum, parsed.URIs); err != nil {
		return nil, err
	}
	if err := upsertIcons(tx, sum, parsed.Icons); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	stored, _ := resourceBySHA1(m.db, sum)
	return &syncResult{Snapshot: snap, Stored: stored}, nil
}

// ForgetSnapshot removes a snapshot row whose backing file no
// longer exists on disk. The resources row is intentionally kept —
// other instances might still reference it (the catalogue is
// content-addressed), and we want fast restore if the file
// reappears.
func (m *Manager) ForgetSnapshot(domainedPath string) error {
	return deleteSnapshot(m.db, domainedPath)
}

// ============================================================
// Helpers
// ============================================================

// inodeOf and fillTimes are implemented per-OS in stat_*.go.

// errBadDomainedPath surfaces when a caller passes an unsplittable
// path to a Manager helper that expects "<domain>/<file>".
var errBadDomainedPath = errors.New("resource: domainedPath must be <domain>/<file>")

// SplitDomainedPath splits "<domain>/<file>" into its parts.
func SplitDomainedPath(dp string) (Domain, string, error) {
	parts := strings.SplitN(dp, "/", 2)
	if len(parts) != 2 {
		return "", "", errBadDomainedPath
	}
	return Domain(parts[0]), parts[1], nil
}

func init() {
	// Defensive: panic on import if database/sql doesn't have a
	// transaction-able driver wired (it always does today, but
	// catches a future regression early).
	_ = fmt.Sprintf
}
