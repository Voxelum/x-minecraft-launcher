package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
)

// ============================================================
// Wire types — match the on-disk JSON shape
// ============================================================

// Download is the standard download descriptor (sha1 / size / url).
type Download struct {
	SHA1 string `json:"sha1,omitempty"`
	Size int64  `json:"size,omitempty"`
	URL  string `json:"url,omitempty"`
}

// Artifact is a downloadable item with an on-disk path.
type Artifact struct {
	Download
	Path string `json:"path,omitempty"`
}

// AssetIndex carries the indexed-assets reference plus a total size.
type AssetIndex struct {
	Download
	ID        string `json:"id"`
	TotalSize int64  `json:"totalSize,omitempty"`
}

// LoggingFile is a Download with an extra id (used in logging.client).
type LoggingFile struct {
	Download
	ID string `json:"id"`
}

// LoggingEntry describes the `logging.client` block.
type LoggingEntry struct {
	File     LoggingFile `json:"file"`
	Argument string      `json:"argument,omitempty"`
	Type     string      `json:"type,omitempty"`
}

// JavaVersionSpec mirrors the `javaVersion` block.
type JavaVersionSpec struct {
	Component    string `json:"component"`
	MajorVersion int    `json:"majorVersion"`
}

// LibraryDownloads carries the Mojang-format `downloads` block on a
// library. `Classifiers` keys are platform identifiers (e.g.
// `natives-windows`) and only exist on native libraries.
type LibraryDownloads struct {
	Artifact    *Artifact            `json:"artifact,omitempty"`
	Classifiers map[string]*Artifact `json:"classifiers,omitempty"`
}

// LibraryExtract describes the `extract` block on native libs.
type LibraryExtract struct {
	Exclude []string `json:"exclude,omitempty"`
}

// Library mirrors `version.json` library entries (covers Normal,
// Native, PlatformSpecific, and Legacy shapes).
type Library struct {
	Name      string             `json:"name"`
	Downloads *LibraryDownloads  `json:"downloads,omitempty"`
	Rules     []Rule             `json:"rules,omitempty"`
	Extract   *LibraryExtract    `json:"extract,omitempty"`
	Natives   map[string]string  `json:"natives,omitempty"`

	// Legacy fields:
	URL       string   `json:"url,omitempty"`
	Checksums []string `json:"checksums,omitempty"`
	ServerReq *bool    `json:"serverreq,omitempty"`
	ClientReq *bool    `json:"clientreq,omitempty"`
}

// LaunchArgument is either a bare string or a rule-gated object whose
// `value` is either a string or a list of strings. We keep it as a
// `json.RawMessage` so the caller can decide; helpers below normalise
// to a flat string slice.
type LaunchArgument struct {
	Plain string
	Rules []Rule
	Value []string // always a slice; single-string case has len==1
}

// UnmarshalJSON accepts both shapes of the LaunchArgument schema.
func (a *LaunchArgument) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		a.Plain = s
		return nil
	}
	var raw struct {
		Rules []Rule          `json:"rules"`
		Value json.RawMessage `json:"value"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	a.Rules = raw.Rules
	if len(raw.Value) == 0 {
		return nil
	}
	if raw.Value[0] == '"' {
		var s string
		if err := json.Unmarshal(raw.Value, &s); err != nil {
			return err
		}
		a.Value = []string{s}
		return nil
	}
	return json.Unmarshal(raw.Value, &a.Value)
}

// Resolve expands the argument under the given platform + features.
// Returns the flat slice of strings the JVM/Minecraft command line
// will receive (after template substitution by the launch builder).
func (a LaunchArgument) Resolve(platform Platform, features []string) []string {
	if a.Plain != "" {
		return []string{a.Plain}
	}
	if !CheckAllowed(a.Rules, platform, features) {
		return nil
	}
	return a.Value
}

// VersionArguments wraps the `arguments.jvm` / `arguments.game` blocks.
type VersionArguments struct {
	JVM  []LaunchArgument `json:"jvm,omitempty"`
	Game []LaunchArgument `json:"game,omitempty"`
}

// Version mirrors the version JSON wire shape.
type Version struct {
	ID                     string                  `json:"id"`
	Time                   string                  `json:"time,omitempty"`
	Type                   string                  `json:"type,omitempty"`
	ReleaseTime            string                  `json:"releaseTime,omitempty"`
	InheritsFrom           string                  `json:"inheritsFrom,omitempty"`
	MinimumLauncherVersion int                     `json:"minimumLauncherVersion,omitempty"`

	MinecraftArguments string            `json:"minecraftArguments,omitempty"`
	Arguments          *VersionArguments `json:"arguments,omitempty"`

	MainClass string    `json:"mainClass,omitempty"`
	Libraries []Library `json:"libraries,omitempty"`

	Jar string `json:"jar,omitempty"`

	AssetIndex *AssetIndex          `json:"assetIndex,omitempty"`
	Assets     string               `json:"assets,omitempty"`
	Downloads  map[string]*Download `json:"downloads,omitempty"`

	Logging map[string]LoggingEntry `json:"logging,omitempty"`

	JavaVersion *JavaVersionSpec `json:"javaVersion,omitempty"`

	// Non-standard fields used by third-party launchers / patches.
	ClientVersion    string `json:"clientVersion,omitempty"`
	MinecraftVersion string `json:"_minecraftVersion,omitempty"`
}

// ResolvedLibrary is a Library after rule evaluation + classifier
// resolution. Native libraries are flagged with `IsNative`.
type ResolvedLibrary struct {
	LibraryInfo
	Download       Artifact
	IsNative       bool
	ExtractExclude []string
	// Legacy fields (only meaningful for libraries from old Forge
	// versions). Default unset == treat as required for both.
	Checksums []string
	ServerReq *bool
	ClientReq *bool
}

// ResolvedVersion is the merged-inheritance form of a version. This
// is what LaunchService consumes.
type ResolvedVersion struct {
	ID                     string
	Arguments              VersionArguments
	MainClass              string
	AssetIndex             *AssetIndex
	Assets                 string
	Downloads              map[string]*Download
	Libraries              []ResolvedLibrary
	MinimumLauncherVersion int
	ReleaseTime            string
	Time                   string
	Type                   string
	Logging                map[string]LoggingEntry
	JavaVersion            JavaVersionSpec
	MinecraftVersion       string
	MinecraftDirectory     string
	// Inheritances lists the version IDs walked, with this version
	// first and the root Minecraft version last.
	Inheritances []string
	// PathChain holds `versions/<id>` for each inheritance entry, in
	// the same order.
	PathChain []string
}

// ============================================================
// Errors
// ============================================================

// ParseError discriminates the version JSON parse failure modes.
type ParseError struct {
	Kind    string // "MissingVersionJson" / "CorruptedVersionJson" / "BadVersionJson" / "CircularDependencies"
	Version string
	Missing string   // for BadVersionJson: "MainClass"
	Path    string   // for MissingVersionJson
	Chain   []string // for CircularDependencies
	Cause   error
}

func (e *ParseError) Error() string {
	switch e.Kind {
	case "MissingVersionJson":
		return fmt.Sprintf("core: missing version json for %q at %s: %v", e.Version, e.Path, e.Cause)
	case "CorruptedVersionJson":
		return fmt.Sprintf("core: corrupted version json for %q: %v", e.Version, e.Cause)
	case "BadVersionJson":
		return fmt.Sprintf("core: bad version json for %q (missing %s)", e.Version, e.Missing)
	case "CircularDependencies":
		return fmt.Sprintf("core: circular dependencies for %q: %s", e.Version, strings.Join(e.Chain, " -> "))
	}
	return fmt.Sprintf("core: parse error: %v", e.Cause)
}

func (e *ParseError) Unwrap() error { return e.Cause }

// ============================================================
// Parse
// ============================================================

// ParseVersion walks the version-id chain starting at `version`,
// following `inheritsFrom` references, and produces the merged
// `ResolvedVersion`. Mirrors `Version.parse` from the TS reference.
func ParseVersion(mc MinecraftFolder, version string, platform Platform) (*ResolvedVersion, error) {
	hierarchy, err := resolveDependency(mc, version, platform)
	if err != nil {
		return nil, err
	}
	return resolve(mc, hierarchy, platform)
}

// resolveDependency walks the `inheritsFrom` chain. Returns the
// hierarchy with the user-provided version at index 0 and the root
// Minecraft version at the end (matching the TS reference).
func resolveDependency(mc MinecraftFolder, version string, platform Platform) ([]Version, error) {
	stack := []Version{}

	var walk func(v string) error
	walk = func(v string) error {
		path := mc.VersionJSON(v)
		raw, err := os.ReadFile(path)
		if err != nil {
			return &ParseError{Kind: "MissingVersionJson", Version: v, Path: path, Cause: err}
		}

		var parsed Version
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return &ParseError{Kind: "CorruptedVersionJson", Version: v, Cause: err}
		}
		// Filter JVM args once on parse so downstream code can iterate
		// without re-evaluating rules every cycle.
		parsed.Arguments = normaliseArguments(parsed.Arguments, parsed.MinecraftArguments, platform)
		// Pre-resolve libraries per the host platform.
		parsed.Libraries = filterLibrariesByPlatform(parsed.Libraries, platform)
		stack = append(stack, parsed)

		next := parsed.InheritsFrom
		if next == "" {
			return nil
		}
		for _, existing := range stack {
			if existing.ID == next {
				chain := make([]string, 0, len(stack)+1)
				for _, e := range stack {
					chain = append(chain, e.ID)
				}
				chain = append(chain, next)
				return &ParseError{Kind: "CircularDependencies", Version: version, Chain: chain}
			}
		}
		return walk(next)
	}
	if err := walk(version); err != nil {
		return nil, err
	}
	return stack, nil
}

// normaliseArguments fills in defaults for old-format version JSONs
// (with `minecraftArguments` instead of `arguments`) and filters the
// JVM args by OS rule the same way the TS reference does.
func normaliseArguments(args *VersionArguments, legacy string, platform Platform) *VersionArguments {
	if args == nil {
		args = &VersionArguments{}
	}
	if args.JVM == nil && args.Game == nil && legacy != "" {
		// Old format: split the `minecraftArguments` string into game
		// args and use the canonical JVM defaults from the TS code.
		for _, token := range strings.Fields(legacy) {
			args.Game = append(args.Game, LaunchArgument{Plain: token})
		}
		args.JVM = defaultLegacyJVMArguments()
	}
	// Filter the JVM args by OS-only rules; feature-gated args are
	// left for the launch step (since features depend on launch-time
	// options).
	out := make([]LaunchArgument, 0, len(args.JVM))
	for _, a := range args.JVM {
		if a.Plain != "" {
			out = append(out, a)
			continue
		}
		if hasOnlyOSRules(a.Rules) {
			if !CheckAllowed(a.Rules, platform, nil) {
				continue
			}
		}
		out = append(out, a)
	}
	args.JVM = out
	return args
}

func hasOnlyOSRules(rules []Rule) bool {
	for _, r := range rules {
		if len(r.Features) > 0 {
			return false
		}
	}
	return true
}

// defaultLegacyJVMArguments mirrors the hard-coded list in
// `normalizeVersionJson` for pre-1.13 version JSONs that only carry
// `minecraftArguments`.
func defaultLegacyJVMArguments() []LaunchArgument {
	return []LaunchArgument{
		{
			Rules: []Rule{{Action: "allow", OS: &RuleOS{Name: "windows"}}},
			Value: []string{"-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump"},
		},
		{
			Rules: []Rule{{Action: "allow", OS: &RuleOS{Name: "windows", Version: `^10\.`}}},
			Value: []string{"-Dos.name=Windows 10", "-Dos.version=10.0"},
		},
		{Plain: "-Djava.library.path=${natives_directory}"},
		{Plain: "-Dminecraft.launcher.brand=${launcher_name}"},
		{Plain: "-Dminecraft.launcher.version=${launcher_version}"},
		{Plain: "-cp"},
		{Plain: "${classpath}"},
	}
}

// filterLibrariesByPlatform drops libraries whose `rules` reject the
// current platform. Native libraries are kept regardless (the launch
// path inspects `Natives` to decide what to extract).
func filterLibrariesByPlatform(libs []Library, platform Platform) []Library {
	out := make([]Library, 0, len(libs))
	for _, lib := range libs {
		if len(lib.Rules) == 0 {
			out = append(out, lib)
			continue
		}
		if CheckAllowed(lib.Rules, platform, nil) {
			out = append(out, lib)
		}
	}
	return out
}

// resolve merges the hierarchy into a single ResolvedVersion. The
// outermost (first) version's id wins as `ID`, and per-version libraries
// are deduped by group:artifact (with classifier discriminating
// natives).
func resolve(mc MinecraftFolder, hierarchy []Version, platform Platform) (*ResolvedVersion, error) {
	if len(hierarchy) == 0 {
		return nil, errors.New("core: empty hierarchy")
	}
	root := hierarchy[len(hierarchy)-1]
	out := &ResolvedVersion{
		ID:                 hierarchy[0].ID,
		MinecraftDirectory: mc.Root,
		Assets:             root.Assets,
		AssetIndex:         root.AssetIndex,
		Downloads:          map[string]*Download{},
		Logging:            map[string]LoggingEntry{},
		JavaVersion:        JavaVersionSpec{MajorVersion: 8, Component: "jre-legacy"},
		MinecraftVersion:   coalesce(root.ClientVersion, root.MinecraftVersion, root.ID),
	}
	out.Inheritances = make([]string, len(hierarchy))
	out.PathChain = make([]string, len(hierarchy))
	for i, v := range hierarchy {
		out.Inheritances[i] = v.ID
		out.PathChain[i] = mc.VersionRoot(v.ID)
	}

	libMap := map[string]ResolvedLibrary{}
	nativeMap := map[string]ResolvedLibrary{}

	// Walk from root outward (matching the TS pop loop) so outer
	// overrides land last.
	for i := len(hierarchy) - 1; i >= 0; i-- {
		j := hierarchy[i]
		if j.MinimumLauncherVersion > out.MinimumLauncherVersion {
			out.MinimumLauncherVersion = j.MinimumLauncherVersion
		}

		// TS reference treats every non-legacy version JSON as
		// arg-additive; pre-1.13 (with `minecraftArguments`) replaces
		// the args wholesale. We approximate: if `j.MinecraftArguments`
		// is set we replace; otherwise we append.
		if j.MinecraftArguments != "" {
			out.Arguments.Game = j.Arguments.Game
			out.Arguments.JVM = j.Arguments.JVM
		} else {
			if j.Arguments != nil {
				out.Arguments.Game = append(out.Arguments.Game, j.Arguments.Game...)
				out.Arguments.JVM = append(out.Arguments.JVM, j.Arguments.JVM...)
			}
		}

		if j.ReleaseTime != "" {
			out.ReleaseTime = j.ReleaseTime
		}
		if j.Time != "" {
			out.Time = j.Time
		}
		if j.Type != "" {
			out.Type = j.Type
		}
		if j.MainClass != "" {
			out.MainClass = j.MainClass
		}
		if j.AssetIndex != nil {
			out.AssetIndex = j.AssetIndex
		}
		if j.Assets != "" {
			out.Assets = j.Assets
		}
		if j.JavaVersion != nil {
			out.JavaVersion = *j.JavaVersion
		}
		for k, v := range j.Downloads {
			out.Downloads[k] = v
		}
		for k, v := range j.Logging {
			out.Logging[k] = v
		}

		for _, lib := range j.Libraries {
			resolved, native, ok := resolveLibrary(lib, platform)
			if !ok {
				continue
			}
			key := resolved.GroupID + ":" + resolved.ArtifactID
			if resolved.Classifier != "" {
				key += "-" + resolved.Classifier
			}
			if native {
				nativeMap[key] = resolved
			} else {
				libMap[key] = resolved
			}
		}
	}

	if out.MainClass == "" {
		return nil, &ParseError{Kind: "BadVersionJson", Version: out.ID, Missing: "MainClass"}
	}

	out.Libraries = make([]ResolvedLibrary, 0, len(libMap)+len(nativeMap))
	for _, v := range libMap {
		out.Libraries = append(out.Libraries, v)
	}
	for _, v := range nativeMap {
		out.Libraries = append(out.Libraries, v)
	}
	return out, nil
}

// resolveLibrary maps a Library into a ResolvedLibrary. The bool
// return reports `isNative`; the ok flag is false when the library
// should be dropped (e.g. native missing classifier for the platform).
func resolveLibrary(lib Library, platform Platform) (ResolvedLibrary, bool, bool) {
	info := ParseLibraryName(lib.Name)

	// Native (legacy format with `natives` map).
	if len(lib.Natives) > 0 {
		osKey := lib.Natives[platform.Name]
		if osKey == "" {
			return ResolvedLibrary{}, true, false
		}
		// Substitute `${arch}` in the classifier — vanilla writes
		// `natives-windows-${arch}` with the trailing 32/64.
		classifier := strings.ReplaceAll(osKey, "${arch}", strings.TrimPrefix(platform.Arch, "x"))
		var artifact *Artifact
		if lib.Downloads != nil {
			artifact = lib.Downloads.Classifiers[classifier]
		}
		nativeInfo := ParseLibraryName(lib.Name + ":" + classifier)
		if artifact == nil {
			artifact = &Artifact{Path: nativeInfo.Path,
				Download: Download{URL: "https://libraries.minecraft.net/" + nativeInfo.Path}}
		}
		if artifact.Path == "" {
			artifact.Path = nativeInfo.Path
		}
		res := ResolvedLibrary{
			LibraryInfo: nativeInfo,
			Download:    *artifact,
			IsNative:    true,
		}
		if lib.Extract != nil {
			res.ExtractExclude = lib.Extract.Exclude
		}
		return res, true, true
	}

	if lib.Downloads != nil && lib.Downloads.Artifact != nil {
		art := *lib.Downloads.Artifact
		if art.Path == "" {
			art.Path = info.Path
		}
		if art.URL == "" {
			if info.GroupID == "net.minecraftforge" {
				art.URL = "https://files.minecraftforge.net/maven/" + art.Path
			} else {
				art.URL = "https://libraries.minecraft.net/" + art.Path
			}
		}
		return ResolvedLibrary{LibraryInfo: info, Download: art}, false, true
	}

	// Legacy format (`url` + optional `checksums`).
	maven := lib.URL
	if maven == "" {
		maven = "https://libraries.minecraft.net/"
	}
	artifact := Artifact{
		Path:     info.Path,
		Download: Download{URL: maven + info.Path},
	}
	if len(lib.Checksums) > 0 {
		artifact.SHA1 = lib.Checksums[0]
	}
	return ResolvedLibrary{
		LibraryInfo: info,
		Download:    artifact,
		Checksums:   lib.Checksums,
		ServerReq:   lib.ServerReq,
		ClientReq:   lib.ClientReq,
	}, false, true
}

func coalesce(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
