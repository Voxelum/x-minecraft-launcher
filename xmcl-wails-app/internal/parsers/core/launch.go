package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// LaunchOption carries everything `GenerateArguments` needs. The TS
// reference has more fields (yggdrasil agent, log4j replacement, etc.)
// — they land in this struct as we wire each feature in G5+.
type LaunchOption struct {
	// Version can be a string (version id) or a pre-parsed
	// `*ResolvedVersion`. The former triggers an on-disk parse; the
	// latter is used directly. Set exactly one.
	Version         string
	ResolvedVersion *ResolvedVersion

	// GamePath is the working directory the JVM runs in.
	GamePath string
	// ResourcePath defaults to GamePath when empty.
	ResourcePath string

	// JavaPath is the absolute path to the `java` binary.
	JavaPath string

	// Platform overrides CurrentPlatform() when set.
	Platform *Platform

	// GameProfile carries the auth identity. Empty fields fall back
	// to Mojang's "Steve" + a random UUID.
	GameProfile *GameProfile

	// AccessToken used by Yggdrasil-style auth. Random UUID when empty.
	AccessToken string
	// UserType defaults to "msa" (Microsoft).
	UserType string
	// Properties is the JSON-encoded extra auth properties bag.
	Properties map[string]any

	// Features enables version-JSON feature gates ("is_demo_user",
	// "has_custom_resolution", "is_quick_play_singleplayer", …).
	Features map[string]bool

	// MinMemory / MaxMemory in megabytes. Zero means "don't set".
	MinMemory int
	MaxMemory int

	// LauncherName / LauncherBrand substituted into JVM templates.
	LauncherName  string
	LauncherBrand string

	// NativeRoot overrides the default `<version>-natives` directory.
	NativeRoot string

	// GameName / GameIcon for macOS Dock customisation.
	GameName string
	GameIcon string

	// Resolution overrides the in-game window size.
	Resolution *Resolution

	// VersionName / VersionType override the in-game display.
	VersionName string
	VersionType string

	// ExtraJVMArgs / ExtraMCArgs / ExtraClassPaths inject user
	// customisations. ExtraJVMArgs == nil triggers DEFAULT_EXTRA_JVM_ARGS.
	ExtraJVMArgs    []string
	ExtraMCArgs     []string
	ExtraClassPaths []string

	// QuickPlayMultiplayer + Server are mutually-exclusive
	// fast-connect options. The renderer chooses one.
	QuickPlayMultiplayer string
	Server               *Server

	// Demo enables `--demo`.
	Demo bool

	// PrependCommand runs before java (e.g. `nice`, `prime-run`).
	PrependCommand string

	// YggdrasilAgent injects authlib-injector flags.
	YggdrasilAgent *YggdrasilAgent

	// IgnoreInvalidMinecraftCertificates / IgnorePatchDiscrepancies
	// mirror the forge-era debug flags.
	IgnoreInvalidMinecraftCertificates bool
	IgnorePatchDiscrepancies           bool

	// UseHashAssetsIndex picks `assetIndex.sha1` over the friendly id
	// when looking up the asset index file on disk.
	UseHashAssetsIndex bool
}

// GameProfile carries the player identity for the launch.
type GameProfile struct {
	ID   string
	Name string
}

// Resolution overrides the in-game window size at launch.
type Resolution struct {
	Width      int
	Height     int
	Fullscreen bool
}

// Server is the direct-connect option.
type Server struct {
	IP   string
	Port int
}

// YggdrasilAgent is the authlib-injector glue.
type YggdrasilAgent struct {
	Jar        string
	Server     string
	Prefetched string
}

// DefaultExtraJVMArgs mirrors the TS DEFAULT_EXTRA_JVM_ARGS.
var DefaultExtraJVMArgs = []string{
	"-Xmx2G",
	"-XX:+UnlockExperimentalVMOptions",
	"-XX:+UseG1GC",
	"-XX:G1NewSizePercent=20",
	"-XX:G1ReservePercent=20",
	"-XX:MaxGCPauseMillis=50",
	"-XX:G1HeapRegionSize=32M",
}

// GenerateArguments assembles the command-line slice the host should
// hand to `os/exec`. The first element is the java binary; the rest
// are flags + main class + program args, in the same order as the TS
// reference produces them.
func GenerateArguments(opts LaunchOption) ([]string, error) {
	platform := CurrentPlatform()
	if opts.Platform != nil {
		platform = *opts.Platform
	}
	features := enabledFeatureList(opts.Features)
	gamePath := opts.GamePath
	if !filepath.IsAbs(gamePath) {
		abs, err := filepath.Abs(gamePath)
		if err != nil {
			return nil, fmt.Errorf("GenerateArguments: resolve gamePath: %w", err)
		}
		gamePath = abs
	}
	resourcePath := opts.ResourcePath
	if resourcePath == "" {
		resourcePath = gamePath
	}

	// Acquire the ResolvedVersion.
	var version *ResolvedVersion
	if opts.ResolvedVersion != nil {
		version = opts.ResolvedVersion
	} else if opts.Version != "" {
		mc := NewMinecraftFolder(resourcePath)
		v, err := ParseVersion(mc, opts.Version, platform)
		if err != nil {
			return nil, err
		}
		version = v
	} else {
		return nil, fmt.Errorf("GenerateArguments: version (string) or resolvedVersion required")
	}

	mc := NewMinecraftFolder(resourcePath)

	nativeRoot := opts.NativeRoot
	if nativeRoot == "" {
		nativeRoot = mc.NativesRoot(version.ID)
	}

	gp := opts.GameProfile
	if gp == nil {
		gp = &GameProfile{}
	}
	if gp.ID == "" {
		gp.ID = randomUUIDHex()
	}
	if gp.Name == "" {
		gp.Name = "Steve"
	}
	accessToken := opts.AccessToken
	if accessToken == "" {
		accessToken = randomUUIDHex()
	}
	userType := opts.UserType
	if userType == "" {
		userType = "msa"
	}
	launcherName := opts.LauncherName
	if launcherName == "" {
		launcherName = "Launcher"
	}
	launcherBrand := opts.LauncherBrand
	if launcherBrand == "" {
		launcherBrand = "0.0.1"
	}

	cmd := []string{opts.JavaPath}

	// macOS Dock niceties.
	if platform.Name == "osx" {
		gameName := opts.GameName
		if gameName == "" {
			gameName = "Minecraft"
		}
		cmd = append(cmd, "-Xdock:name="+gameName)
		if opts.GameIcon != "" {
			cmd = append(cmd, "-Xdock:icon="+opts.GameIcon)
		}
	}

	if opts.MinMemory > 0 {
		cmd = append(cmd, fmt.Sprintf("-Xms%dM", opts.MinMemory))
	}
	if opts.MaxMemory > 0 {
		cmd = append(cmd, fmt.Sprintf("-Xmx%dM", opts.MaxMemory))
	}
	if opts.IgnoreInvalidMinecraftCertificates {
		cmd = append(cmd, "-Dfml.ignoreInvalidMinecraftCertificates=true")
	}
	if opts.IgnorePatchDiscrepancies {
		cmd = append(cmd, "-Dfml.ignorePatchDiscrepancies=true")
	}
	if opts.YggdrasilAgent != nil {
		ag := opts.YggdrasilAgent
		cmd = append(cmd,
			fmt.Sprintf("-javaagent:%s=%s", ag.Jar, ag.Server),
			"-Dauthlibinjector.side=client",
		)
		if ag.Prefetched != "" {
			cmd = append(cmd, "-Dauthlibinjector.yggdrasil.prefetched="+ag.Prefetched)
		}
	}

	// Build the classpath.
	classpath := make([]string, 0, len(version.Libraries)+1)
	for _, lib := range version.Libraries {
		if lib.IsNative {
			continue
		}
		classpath = append(classpath, mc.LibraryByPath(lib.Download.Path))
	}
	classpath = append(classpath, mc.VersionJar(version.MinecraftVersion, ""))
	classpath = append(classpath, opts.ExtraClassPaths...)
	for i, p := range classpath {
		classpath[i] = strings.ReplaceAll(p, "\\", "/")
	}

	jvmTemplate := map[string]string{
		"natives_directory":  strings.ReplaceAll(nativeRoot, "\\", "/"),
		"launcher_name":      launcherName,
		"launcher_version":   launcherBrand,
		"game_directory":     strings.ReplaceAll(gamePath, "\\", "/"),
		"classpath":          strings.Join(classpath, classpathSep(platform)),
		"library_directory":  strings.ReplaceAll(mc.Libraries(), "\\", "/"),
		"classpath_separator": classpathSep(platform),
		"version_name":       version.MinecraftVersion,
	}

	jvmArgs := resolveArguments(version.Arguments.JVM, platform, features)

	// Logging arg substitution (per-version `logging.client.argument`).
	if client, ok := version.Logging["client"]; ok && client.Argument != "" {
		filePath := mc.LogConfig(client.File.ID)
		if _, err := os.Stat(filePath); err == nil {
			jvmArgs = append(jvmArgs, strings.ReplaceAll(client.Argument, "${path}", filePath))
		}
	}

	for _, arg := range jvmArgs {
		cmd = append(cmd, formatTemplate(arg, jvmTemplate))
	}

	// Library-directory hint for Forge installer compatibility.
	hasLibDir := false
	for _, v := range cmd {
		if strings.HasPrefix(v, "-DlibraryDirectory") {
			hasLibDir = true
			break
		}
	}
	if !hasLibDir {
		cmd = append(cmd, "-DlibraryDirectory="+strings.ReplaceAll(mc.Libraries(), "\\", "/"))
	}

	if opts.ExtraJVMArgs != nil {
		cmd = append(cmd, opts.ExtraJVMArgs...)
	} else {
		extra := DefaultExtraJVMArgs
		if opts.MaxMemory > 0 {
			// MaxMemory was already pushed via `-Xmx<n>M`; drop the
			// default `-Xmx2G` from the extras to avoid duplication.
			filtered := make([]string, 0, len(extra))
			for _, a := range extra {
				if a == "-Xmx2G" {
					continue
				}
				filtered = append(filtered, a)
			}
			extra = filtered
		}
		cmd = append(cmd, extra...)
	}

	cmd = append(cmd, version.MainClass)

	// Build the game-arg template.
	assetsDir := filepath.Join(resourcePath, "assets")
	assetsIndex := version.Assets
	if opts.UseHashAssetsIndex && version.AssetIndex != nil && version.AssetIndex.SHA1 != "" {
		assetsIndex = version.AssetIndex.SHA1
	}
	versionName := opts.VersionName
	if versionName == "" {
		versionName = version.ID
	}
	versionType := opts.VersionType
	if versionType == "" {
		versionType = version.Type
	}
	propsJSON := "{}"
	if len(opts.Properties) > 0 {
		raw, err := json.Marshal(opts.Properties)
		if err == nil {
			propsJSON = string(raw)
		}
	}

	resWidth, resHeight := -1, -1
	if opts.Resolution != nil {
		resWidth = opts.Resolution.Width
		resHeight = opts.Resolution.Height
	}

	mcTemplate := map[string]string{
		"version_name":       versionName,
		"version_type":       versionType,
		"assets_root":        strings.ReplaceAll(assetsDir, "\\", "/"),
		"game_assets":        strings.ReplaceAll(filepath.Join(assetsDir, "virtual", version.Assets), "\\", "/"),
		"assets_index_name":  assetsIndex,
		"auth_session":       accessToken,
		"game_directory":     strings.ReplaceAll(gamePath, "\\", "/"),
		"auth_player_name":   gp.Name,
		"auth_uuid":          gp.ID,
		"auth_access_token":  accessToken,
		"user_properties":    propsJSON,
		"user_type":          userType,
		"resolution_width":   fmt.Sprintf("%d", resWidth),
		"resolution_height":  fmt.Sprintf("%d", resHeight),
	}

	gameArgs := resolveArguments(version.Arguments.Game, platform, features)
	for _, arg := range gameArgs {
		cmd = append(cmd, formatTemplate(arg, mcTemplate))
	}

	cmd = append(cmd, opts.ExtraMCArgs...)
	if opts.QuickPlayMultiplayer != "" {
		cmd = append(cmd, "--quickPlayMultiplayer", opts.QuickPlayMultiplayer)
	}
	if opts.Server != nil {
		cmd = append(cmd, "--server", opts.Server.IP)
		if opts.Server.Port != 0 {
			cmd = append(cmd, "--port", fmt.Sprintf("%d", opts.Server.Port))
		}
	}
	// Resolution: only inject when the version's arguments didn't
	// already include `--width` (modern arg trees include it via
	// feature gates).
	hasWidthFlag := false
	for _, a := range cmd {
		if a == "--width" {
			hasWidthFlag = true
			break
		}
	}
	if opts.Resolution != nil && !hasWidthFlag {
		if opts.Resolution.Fullscreen {
			cmd = append(cmd, "--fullscreen")
		} else {
			if opts.Resolution.Height > 0 {
				cmd = append(cmd, "--height", fmt.Sprintf("%d", opts.Resolution.Height))
			}
			if opts.Resolution.Width > 0 {
				cmd = append(cmd, "--width", fmt.Sprintf("%d", opts.Resolution.Width))
			}
		}
	}
	if opts.Demo {
		cmd = append(cmd, "--demo")
	}

	if opts.PrependCommand != "" {
		prepend := splitPrependCommand(opts.PrependCommand)
		cmd = append(prepend, cmd...)
	}
	return cmd, nil
}

// ============================================================
// Helpers
// ============================================================

// classpathSep mirrors `path.delimiter` (";" on Windows, ":" elsewhere).
func classpathSep(platform Platform) string {
	if platform.Name == "windows" {
		return ";"
	}
	return ":"
}

// resolveArguments expands LaunchArgument entries into a flat slice.
func resolveArguments(args []LaunchArgument, platform Platform, features []string) []string {
	out := make([]string, 0, len(args))
	for _, a := range args {
		out = append(out, a.Resolve(platform, features)...)
	}
	return out
}

// enabledFeatureList returns the keys whose value is true. (The TS
// `Features` map permits objects too; we treat any non-false entry as
// enabled for rule evaluation.)
func enabledFeatureList(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k, v := range m {
		if v {
			out = append(out, k)
		}
	}
	return out
}

// formatTemplate replaces `${name}` placeholders. Unknown placeholders
// pass through unchanged (matches the TS reference's "value || key"
// fallback).
var templateRe = regexp.MustCompile(`\$\{([^}]*)\}`)

func formatTemplate(s string, args map[string]string) string {
	return templateRe.ReplaceAllStringFunc(s, func(match string) string {
		key := match[2 : len(match)-1]
		if v, ok := args[key]; ok {
			return v
		}
		return match
	})
}

// splitPrependCommand tokenises a shell-like prepend command. We
// intentionally avoid a real shell parse — the TS reference just
// space-splits.
func splitPrependCommand(s string) []string {
	out := []string{}
	for _, token := range strings.Fields(s) {
		out = append(out, token)
	}
	return out
}

// randomUUIDHex returns a 32-character hex string (a UUID minus
// hyphens). Mirrors `randomUUID().replace(/-/g, '')`.
func randomUUIDHex() string {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		// Fall back to a fixed value rather than crashing the launch
		// just because the OS RNG hiccupped (extremely unlikely).
		return "00000000000000000000000000000000"
	}
	// Set version + variant bits so the result is a valid v4 UUID
	// (avoids confusing servers that parse the field).
	buf[6] = (buf[6] & 0x0f) | 0x40
	buf[8] = (buf[8] & 0x3f) | 0x80
	return hex.EncodeToString(buf[:])
}
