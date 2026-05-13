// javapick.go — tiny helper that selects a JDK binary from the
// persisted `javas.json` cache. Used by Forge / NeoForge installs to
// pick a JVM for post-processor execution without coupling the
// install service to JavaService directly (services are constructed
// independently in the registry).

package install

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

type javaRecord struct {
	Path         string `json:"path"`
	MajorVersion int    `json:"majorVersion"`
	Valid        bool   `json:"valid"`
	Override     string `json:"override,omitempty"`
}

// pickJava returns the path to the best-fit JDK for an installer
// post-processor run. `preferred`, when non-empty, takes precedence
// if present + valid. The minimum major version filter mirrors what
// modern Forge / NeoForge ship for (Java 17+ for MC 1.20.5+).
//
// We prefer:
//   1. The caller-supplied `preferred` path (when valid).
//   2. The newest JDK whose majorVersion >= minMajor.
//   3. Any valid JDK in the cache.
//
// Returns ("", err) when there's no usable JDK at all — the caller
// surfaces this as a "no Java" error to the renderer.
func pickJava(appDataPath, preferred string, minMajor int) (string, error) {
	if preferred != "" {
		if _, err := os.Stat(preferred); err == nil {
			return preferred, nil
		}
	}
	records, err := loadJavaRecords(appDataPath)
	if err != nil {
		return "", err
	}
	if len(records) == 0 {
		return "", errors.New("install: no JDK records — call JavaService.RefreshLocalJava first")
	}

	var (
		bestExact javaRecord
		bestAny   javaRecord
	)
	for _, r := range records {
		if !r.Valid {
			continue
		}
		if _, err := os.Stat(r.Path); err != nil {
			continue
		}
		if bestAny.Path == "" || r.MajorVersion > bestAny.MajorVersion {
			bestAny = r
		}
		if r.MajorVersion >= minMajor && (bestExact.Path == "" || r.MajorVersion < bestExact.MajorVersion) {
			bestExact = r
		}
	}
	if bestExact.Path != "" {
		return bestExact.Path, nil
	}
	if bestAny.Path != "" {
		return bestAny.Path, nil
	}
	return "", errors.New("install: no valid JDK on disk")
}

func loadJavaRecords(appDataPath string) ([]javaRecord, error) {
	raw, err := os.ReadFile(filepath.Join(appDataPath, "javas.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var records []javaRecord
	if err := json.Unmarshal(raw, &records); err != nil {
		return nil, err
	}
	return records, nil
}
