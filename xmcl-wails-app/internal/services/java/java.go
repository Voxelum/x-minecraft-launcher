// Package java implements contract.JavaService — discover, validate
// and remember the JDK installations the launcher can use.
//
// Discovery sources mirror the TS reference (`packages/installer/java.ts`):
//
//   - JAVA_HOME env var
//   - `where java` / `which java`
//   - On Windows, the `HKLM\Software\JavaSoft\` registry walk
//   - On macOS, the `/Library/Internet Plug-Ins/...` Apple JRE
//
// The persisted list lives in `<appData>/javas.json` so subsequent
// boots skip the discovery dance until the user explicitly refreshes.
package java

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/installer/javaruntime"
	"github.com/voxelum/xmcl/wails/internal/parsers/javaparse"
)

// stateID is the canonical SharedState id for JavaState. Matches the
// service-key convention used by the legacy TS runtime so the
// renderer can dedupe state references across reloads.
const stateID = "JavaService"

// recordsFile is the per-user persistence path under AppDataPath.
const recordsFile = "javas.json"

// Service implements contract.JavaService.
type Service struct {
	contract.JavaServiceNotImplemented

	host   *host.Host
	states *bridge.StateManager

	once    sync.Once
	loadErr error
	state   *bridge.SharedState
	payload *contract.JavaState

	mu      sync.Mutex
	records []record // typed mirror of payload.All; protected by mu
}

// record is the on-wire representation of a JDK install. Mirrors
// xmcl-runtime-api's JavaRecord shape.
type record struct {
	Path         string `json:"path"`
	Version      string `json:"version,omitempty"`
	MajorVersion int    `json:"majorVersion"`
	Valid        bool   `json:"valid"`
	Arch         string `json:"arch,omitempty"`
}

// New constructs a JavaService bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
	return &Service{host: h, states: sm}
}

// Compile-time assertion that we implement the generated contract.
var _ contract.JavaService = (*Service)(nil)

// ============================================================
// Contract methods
// ============================================================

// GetJavaState returns the live JavaState SharedState. First call
// triggers an on-disk load + (when no cached records exist) a
// background scan.
func (s *Service) GetJavaState(_ context.Context) (*bridge.SharedState, error) {
	s.once.Do(func() {
		s.loadErr = s.bootstrap()
	})
	if s.loadErr != nil {
		return nil, s.loadErr
	}
	return s.state, nil
}

// ResolveJava probes a single binary, returning the JavaRecord on
// success. Mirrors `JavaService.resolveJava` from xmcl-runtime.
func (s *Service) ResolveJava(_ context.Context, javaPath string) (any, error) {
	s.bootstrapIfNeeded()
	r, ok := probeJava(javaPath)
	if !ok {
		return nil, nil
	}
	s.upsertRecord(r)
	if err := s.persist(); err != nil {
		s.host.Logger.Warn("java: persist failed", "err", err)
	}
	return recordAsMap(r), nil
}

// RefreshLocalJava re-scans the host for installed JDKs. When `force`
// is true cached records are dropped first; otherwise the existing
// records are revalidated and any newly-discovered binaries are
// appended.
func (s *Service) RefreshLocalJava(_ context.Context, force bool) error {
	s.bootstrapIfNeeded()
	if force {
		s.mu.Lock()
		s.records = s.records[:0]
		s.mu.Unlock()
	}
	candidates := discoverCandidates()
	for _, p := range candidates {
		if r, ok := probeJava(p); ok {
			s.upsertRecord(r)
		}
	}
	// Revalidate every cached entry against the current filesystem so
	// records pointing at uninstalled JDKs flip to invalid.
	s.revalidate()
	s.republishState()
	return s.persist()
}

// RemoveJava drops the record for the given path, if any, and
// republishes the state. The on-disk binary itself is not deleted —
// the renderer only manages the launcher's view of installed JDKs.
func (s *Service) RemoveJava(_ context.Context, javaPath string) error {
	s.bootstrapIfNeeded()
	s.mu.Lock()
	out := s.records[:0]
	for _, r := range s.records {
		if r.Path == javaPath {
			continue
		}
		out = append(out, r)
	}
	s.records = out
	s.mu.Unlock()
	s.republishState()
	return s.persist()
}

// InstallJava downloads the Mojang java-runtime bundle that matches
// `version.component`, extracts it under `<gameData>/jre/<component>/`,
// then probes the resulting binary so the renderer's JavaState
// receives the new entry.
//
// `forceZulu` is accepted for contract parity but currently ignored —
// the Zulu fallback path stays renderer-side until we port the Zulu
// installer in a follow-up.
func (s *Service) InstallJava(ctx context.Context, version contract.JavaVersion, _ bool) (any, error) {
	s.bootstrapIfNeeded()
	component := strings.TrimSpace(version.Component)
	if component == "" {
		// Default mirrors the TS reference's `jre-legacy` fallback.
		component = javaruntime.ComponentLegacy
	}
	indexURLs := []string{javaruntime.DefaultIndexURL}
	if mirror := s.host.Mirror(); mirror.ShouldOverride() {
		if urls := mirror.JavaRuntimesURL(); len(urls) > 0 {
			indexURLs = urls
		}
	}
	dest := filepath.Join(s.host.MinecraftDataPath, "jre")
	res, err := javaruntime.New(s.host.HTTP).Install(ctx, javaruntime.Options{
		Destination: dest,
		Component:   component,
		IndexURLs:   indexURLs,
	})
	if err != nil {
		return nil, err
	}
	r, ok := probeJava(res.JavaPath)
	if !ok {
		return nil, errors.New("java: installed bundle but failed to probe binary at " + res.JavaPath)
	}
	s.upsertRecord(r)
	if err := s.persist(); err != nil {
		s.host.Logger.Warn("java: persist after install failed", "err", err)
	}
	s.republishState()
	return recordAsMap(r), nil
}

// ============================================================
// Bootstrap + persistence
// ============================================================

func (s *Service) bootstrapIfNeeded() {
	s.once.Do(func() { s.loadErr = s.bootstrap() })
}

func (s *Service) bootstrap() error {
	s.payload = &contract.JavaState{All: []any{}}

	// Best-effort load of the persisted records.
	if rs, err := loadRecords(filepath.Join(s.host.AppDataPath, recordsFile)); err == nil {
		s.records = rs
	}

	// First launch with no cache → seed an immediate scan so the
	// renderer's "no Java" warning doesn't sit there indefinitely.
	if len(s.records) == 0 {
		for _, p := range discoverCandidates() {
			if r, ok := probeJava(p); ok {
				s.upsertRecord(r)
			}
		}
		if err := s.persist(); err != nil {
			s.host.Logger.Warn("java: initial persist failed", "err", err)
		}
	}

	s.republishState()
	s.state = contract.RegisterJavaState(s.states, stateID, s.payload)
	return nil
}

// upsertRecord stores `r` keyed by its path. Existing entries are
// replaced so revalidation / re-probe results win over cached data.
func (s *Service) upsertRecord(r record) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, existing := range s.records {
		if existing.Path == r.Path {
			s.records[i] = r
			return
		}
	}
	s.records = append(s.records, r)
}

// revalidate flips each record's `Valid` bit based on whether the
// binary still exists. It does not re-run `java -version`; for that
// the renderer should call ResolveJava per-path.
func (s *Service) revalidate() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.records {
		s.records[i].Valid = fileExists(s.records[i].Path)
	}
}

// republishState rebuilds the wire payload from `s.records` so the
// renderer always sees a consistent snapshot.
func (s *Service) republishState() {
	s.mu.Lock()
	defer s.mu.Unlock()
	all := make([]any, 0, len(s.records))
	for _, r := range s.records {
		all = append(all, recordAsMap(r))
	}
	s.payload.All = all
	if s.state != nil {
		// Push a synthetic mutator so renderers tracking this state
		// re-render with the fresh list. We use an `instanceAdd`-style
		// "set" — JavaState only carries `all`, no per-item mutators
		// in the contract, so we re-publish the whole array.
		s.states.Push(s.state.ID, "javaUpdate", all)
	}
}

func (s *Service) persist() error {
	s.mu.Lock()
	cp := append([]record(nil), s.records...)
	s.mu.Unlock()
	return saveRecords(filepath.Join(s.host.AppDataPath, recordsFile), cp)
}

// ============================================================
// Discovery + probing
// ============================================================

// probeJava runs `java -version` and parses the output. The boolean
// is false when the path doesn't exist or the output couldn't be
// parsed.
func probeJava(javaPath string) (record, bool) {
	if !fileExists(javaPath) {
		return record{Path: javaPath, Valid: false}, false
	}
	// `java -version` writes to stderr; we capture both streams to
	// future-proof against vendors who break that convention.
	cmd := exec.Command(javaPath, "-version")
	out, err := cmd.CombinedOutput()
	if err != nil {
		// `java -version` exits 0; an error here is usually a missing
		// .dll on Windows or a permission problem.
		return record{Path: javaPath, Valid: false}, false
	}
	info := javaparse.Parse(string(out))
	if info == nil {
		return record{Path: javaPath, Valid: false}, false
	}
	r := record{
		Path:         javaPath,
		Version:      info.Version,
		MajorVersion: info.MajorVersion,
		Valid:        true,
		Arch:         detectArch(string(out)),
	}
	return r, true
}

// detectArch picks an arch label out of the `java -version` output.
// Modern JDKs print `64-Bit Server VM` (x64) or `32-Bit Client VM`
// (x86); ARM ports print "aarch64" or "arm64". When in doubt we leave
// the field empty so the renderer falls back to the host arch.
func detectArch(out string) string {
	low := strings.ToLower(out)
	switch {
	case strings.Contains(low, "aarch64"), strings.Contains(low, "arm64"):
		return "arm64"
	case strings.Contains(low, "64-bit"):
		return "x64"
	case strings.Contains(low, "32-bit"):
		return "x86"
	}
	return ""
}

// discoverCandidates assembles a list of `java[.exe]` paths that
// might be runnable. De-duplication / probing happens later.
func discoverCandidates() []string {
	seen := map[string]bool{}
	add := func(p string) {
		p = strings.TrimSpace(p)
		if p == "" || seen[p] {
			return
		}
		seen[p] = true
	}

	javaName := "java"
	if runtime.GOOS == "windows" {
		javaName = "java.exe"
	}

	if home := os.Getenv("JAVA_HOME"); home != "" {
		add(filepath.Join(home, "bin", javaName))
	}

	// `which`/`where` produces newline-separated absolute paths; many
	// Windows installs return multiple matches.
	if runtime.GOOS == "windows" {
		for _, p := range execLines("where", "java") {
			add(p)
		}
		for _, p := range registryJavaHomes() {
			add(filepath.Join(p, "bin", javaName))
		}
	} else {
		if line := execLine("which", "java"); line != "" {
			add(line)
		}
		if runtime.GOOS == "darwin" {
			add("/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java")
			// Common system / brew install roots.
			add("/Library/Java/JavaVirtualMachines/Contents/Home/bin/java")
		}
	}

	out := make([]string, 0, len(seen))
	for p := range seen {
		out = append(out, p)
	}
	return out
}

// registryJavaHomes runs `REG QUERY HKLM\Software\JavaSoft\ /s /v
// JavaHome` and returns the JavaHome paths. Empty on non-Windows.
func registryJavaHomes() []string {
	if runtime.GOOS != "windows" {
		return nil
	}
	out := execAll("reg", "query", `HKEY_LOCAL_MACHINE\Software\JavaSoft\`, "/s", "/v", "JavaHome")
	var paths []string
	for _, line := range out {
		// REG QUERY rows look like:
		//     JavaHome    REG_SZ    C:\Program Files\Java\jdk-17.0.9
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "JavaHome") {
			continue
		}
		// Split on the literal `REG_SZ` token; the trailing field is
		// the path.
		parts := strings.SplitN(line, "REG_SZ", 2)
		if len(parts) != 2 {
			continue
		}
		paths = append(paths, strings.TrimSpace(parts[1]))
	}
	return paths
}

func execLine(name string, args ...string) string {
	out, err := exec.Command(name, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(strings.ReplaceAll(string(out), "\r", ""))
}

func execLines(name string, args ...string) []string {
	line := execLine(name, args...)
	if line == "" {
		return nil
	}
	return strings.Split(line, "\n")
}

func execAll(name string, args ...string) []string {
	out, err := exec.Command(name, args...).Output()
	if err != nil {
		return nil
	}
	return strings.Split(strings.ReplaceAll(string(out), "\r", ""), "\n")
}

// ============================================================
// Persistence + helpers
// ============================================================

func loadRecords(path string) ([]record, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var rs []record
	if err := json.Unmarshal(raw, &rs); err != nil {
		return nil, err
	}
	return rs, nil
}

func saveRecords(path string, rs []record) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	raw, err := json.Marshal(rs)
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func recordAsMap(r record) map[string]any {
	return map[string]any{
		"path":         r.Path,
		"version":      r.Version,
		"majorVersion": float64(r.MajorVersion),
		"valid":        r.Valid,
		"arch":         r.Arch,
	}
}

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
