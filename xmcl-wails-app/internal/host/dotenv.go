// dotenv.go — tiny `.env` file loader (KEY=VALUE per line, `#`
// comments, optional surrounding quotes). Used to populate the
// CurseForge API key (and any future build-time secrets) for the
// Go side without dragging in a third-party dependency.
//
// Search order, first hit wins:
//
//   1. `os.Getenv(KEY)` already set on the process.
//   2. `XMCL_DOTENV` env var (absolute path to a `.env` file).
//   3. `<cwd>/.env`
//   4. `<cwd>/xmcl-wails-app/.env`
//   5. `<exeDir>/.env`
//   6. `<cwd>/xmcl-electron-app/.env` — kept for convenience so a
//      developer who already has the Electron secret on disk doesn't
//      need to duplicate it.
//
// The loader is best-effort: any I/O or parse error is logged and the
// caller continues with whatever it already had.

package host

import (
	"bufio"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

// loadDotEnvFor returns the value of `key` resolved from the process
// env first, then any `.env` file along the search path. Empty when
// nothing matched.
func loadDotEnvFor(key string, logger *slog.Logger) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	candidates := dotEnvCandidates()
	for _, path := range candidates {
		val, ok, err := readDotEnvKey(path, key)
		if err != nil {
			if !os.IsNotExist(err) && logger != nil {
				logger.Debug("host: read .env", "path", path, "err", err)
			}
			continue
		}
		if ok {
			if logger != nil {
				logger.Debug("host: loaded secret from .env", "key", key, "path", path)
			}
			return val
		}
	}
	return ""
}

// dotEnvCandidates returns the list of `.env` files to probe, in
// priority order. The walk-up logic exists because the dev workflow
// runs `go -C xmcl-wails-app run .` (cwd = `xmcl-wails-app/`) while
// CI sets the secret via env vars and a developer might keep their
// existing key in `xmcl-electron-app/.env` at the monorepo root.
func dotEnvCandidates() []string {
	out := []string{}
	if explicit := os.Getenv("XMCL_DOTENV"); explicit != "" {
		out = append(out, explicit)
	}
	if cwd, err := os.Getwd(); err == nil {
		walkDotEnvRoots(cwd, &out)
	}
	if exe, err := os.Executable(); err == nil {
		walkDotEnvRoots(filepath.Dir(exe), &out)
	}
	return dedupe(out)
}

// walkDotEnvRoots appends candidate `.env` paths under `start` and
// up to three parent directories so we find the monorepo-rooted
// `xmcl-wails-app/.env` / `xmcl-electron-app/.env` whether the
// process is launched from the repo root or from inside the Go
// module.
func walkDotEnvRoots(start string, out *[]string) {
	dir := start
	for i := 0; i < 4; i++ {
		*out = append(*out,
			filepath.Join(dir, ".env"),
			filepath.Join(dir, "xmcl-wails-app", ".env"),
			filepath.Join(dir, "xmcl-electron-app", ".env"),
		)
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
}

// readDotEnvKey scans a single `.env` file for the requested key.
// Returns (value, found, err). Missing file → (zero, false, ErrNotExist).
func readDotEnvKey(path, key string) (string, bool, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", false, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Tolerate `export FOO=bar` for shell-style files.
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(line[len("export "):])
		}
		eq := strings.IndexByte(line, '=')
		if eq <= 0 {
			continue
		}
		k := strings.TrimSpace(line[:eq])
		if k != key {
			continue
		}
		v := strings.TrimSpace(line[eq+1:])
		// Strip a single layer of matched quotes — `.env` files in
		// the wild routinely wrap values that contain spaces.
		if len(v) >= 2 {
			if (v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'') {
				v = v[1 : len(v)-1]
			}
		}
		return v, true, nil
	}
	return "", false, scanner.Err()
}

func dedupe(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
