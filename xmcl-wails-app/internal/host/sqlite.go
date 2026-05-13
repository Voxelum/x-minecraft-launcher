package host

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	// Pure-Go SQLite driver (registers as "sqlite"). modernc.org/sqlite
	// avoids cgo so cross-compilation stays simple — the trade-off is
	// somewhat slower throughput than mattn/go-sqlite3.
	_ "modernc.org/sqlite"
)

// SQLite manages a pool of named *sql.DB handles, one per logical
// database file. Repeated calls to Open with the same name return the
// same handle so callers can wire migrations once.
type SQLite struct {
	dir string

	mu  sync.Mutex
	dbs map[string]*sql.DB
}

// NewSQLite returns a manager rooted at <appDataPath>/db. The directory
// is created on demand the first time Open is called.
func NewSQLite(appDataPath string) *SQLite {
	return &SQLite{
		dir: filepath.Join(appDataPath, "db"),
		dbs: map[string]*sql.DB{},
	}
}

// Open returns the *sql.DB for the named SQLite database. The name is
// joined under the manager's directory and `.sqlite` is appended.
// Suitable defaults are applied: WAL journaling, foreign-key enforcement,
// and a single writer to avoid the "database is locked" trap.
func (s *SQLite) Open(name string) (*sql.DB, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if db, ok := s.dbs[name]; ok {
		return db, nil
	}
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return nil, fmt.Errorf("sqlite: create dir: %w", err)
	}

	path := filepath.Join(s.dir, name+".sqlite")
	dsn := "file:" + path + "?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("sqlite: open %s: %w", name, err)
	}
	// Modernc's driver is goroutine-safe but a single connection avoids
	// the `database is locked` race entirely. WAL handles read concurrency.
	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("sqlite: ping %s: %w", name, err)
	}

	s.dbs[name] = db
	return db, nil
}

// Close releases every open database handle. Safe to call multiple
// times; subsequent calls are no-ops once closed.
func (s *SQLite) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var firstErr error
	for name, db := range s.dbs {
		if err := db.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("close %s: %w", name, err)
		}
		delete(s.dbs, name)
	}
	return firstErr
}
