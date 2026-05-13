package core

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// mockRoot returns the repo's `mock/` directory (the test fixture
// `.minecraft` root) — every parser test under /xmcl-wails-app walks
// up from the package dir to find it.
func mockRoot(t *testing.T) string {
	t.Helper()
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	dir := cwd
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "mock")
		if info, err := os.Stat(filepath.Join(candidate, "versions")); err == nil && info.IsDir() {
			return candidate
		}
		next := filepath.Dir(dir)
		if next == dir {
			break
		}
		dir = next
	}
	t.Skipf("mock/versions/ fixtures not found; ran from %s", cwd)
	return ""
}

// ============================================================
// Platform + paths
// ============================================================

func TestMinecraftFolderPaths(t *testing.T) {
	mc := NewMinecraftFolder("/root")
	cases := map[string]string{
		mc.Mods():                "/root/mods",
		mc.Versions():            "/root/versions",
		mc.VersionRoot("1.14.4"): "/root/versions/1.14.4",
		mc.VersionJSON("1.14.4"): "/root/versions/1.14.4/1.14.4.json",
		mc.VersionJar("1.14.4", ""): "/root/versions/1.14.4/1.14.4.jar",
		mc.NativesRoot("1.14.4"): "/root/versions/1.14.4/1.14.4-natives",
		mc.Asset("abcdef"):       "/root/assets/objects/ab/abcdef",
		mc.AssetsIndex("1"):      "/root/assets/indexes/1.json",
	}
	for got, want := range cases {
		got := filepath.ToSlash(got)
		if got != want {
			t.Errorf("path = %q, want %q", got, want)
		}
	}
}

// ============================================================
// Library name + path parsing
// ============================================================

func TestParseLibraryName(t *testing.T) {
	info := ParseLibraryName("net.minecraft:client:1.14.4")
	if info.GroupID != "net.minecraft" || info.ArtifactID != "client" || info.Version != "1.14.4" {
		t.Errorf("info = %+v", info)
	}
	if info.Type != "jar" {
		t.Errorf("Type = %q", info.Type)
	}
	if info.Path != "net/minecraft/client/1.14.4/client-1.14.4.jar" {
		t.Errorf("Path = %q", info.Path)
	}
}

func TestParseLibraryName_Classifier(t *testing.T) {
	info := ParseLibraryName("org.lwjgl:lwjgl:3.2.1:natives-windows")
	if info.Classifier != "natives-windows" {
		t.Errorf("Classifier = %q", info.Classifier)
	}
	if info.Path != "org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1-natives-windows.jar" {
		t.Errorf("Path = %q", info.Path)
	}
}

func TestParseLibraryName_TypeOverride(t *testing.T) {
	info := ParseLibraryName("net.minecraftforge:forge:1.0:universal@zip")
	if info.Type != "zip" || info.Classifier != "universal" {
		t.Errorf("info = %+v", info)
	}
	if !strings.HasSuffix(info.Path, ".zip") {
		t.Errorf("Path = %q, want .zip suffix", info.Path)
	}
}

func TestParseLibraryPath_Roundtrip(t *testing.T) {
	original := "net.minecraft:client:1.14.4"
	info := ParseLibraryName(original)
	back := ParseLibraryPath(info.Path)
	if back.Name != original {
		t.Errorf("roundtrip Name = %q, want %q", back.Name, original)
	}
}

// ============================================================
// Rule evaluation
// ============================================================

func TestCheckAllowed_EmptyRules(t *testing.T) {
	if !CheckAllowed(nil, CurrentPlatform(), nil) {
		t.Error("nil rules should allow")
	}
}

func TestCheckAllowed_OSMatch(t *testing.T) {
	rules := []Rule{{Action: "allow", OS: &RuleOS{Name: "windows"}}}
	platforms := map[bool]Platform{
		true:  {Name: "windows", Arch: "x64"},
		false: {Name: "linux", Arch: "x64"},
	}
	for want, p := range platforms {
		if got := CheckAllowed(rules, p, nil); got != want {
			t.Errorf("rules=%v platform=%v → %v, want %v", rules, p, got, want)
		}
	}
}

func TestCheckAllowed_FeatureGate(t *testing.T) {
	rules := []Rule{{Action: "allow", Features: map[string]bool{"is_demo_user": true}}}
	if CheckAllowed(rules, CurrentPlatform(), nil) {
		t.Error("demo feature absent should reject")
	}
	if !CheckAllowed(rules, CurrentPlatform(), []string{"is_demo_user"}) {
		t.Error("demo feature present should allow")
	}
}

// ============================================================
// Version parsing
// ============================================================

func TestParseVersion_Vanilla(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	v, err := ParseVersion(mc, "1.14.4", Platform{Name: "windows", Arch: "x64"})
	if err != nil {
		t.Fatalf("ParseVersion: %v", err)
	}
	if v.ID != "1.14.4" {
		t.Errorf("ID = %q", v.ID)
	}
	if v.MainClass == "" {
		t.Error("MainClass empty")
	}
	if v.MinecraftVersion != "1.14.4" {
		t.Errorf("MinecraftVersion = %q", v.MinecraftVersion)
	}
	if len(v.Libraries) == 0 {
		t.Error("no libraries resolved")
	}
	// Forge / vanilla 1.14.4 carries a Java 8 requirement.
	if v.JavaVersion.MajorVersion == 0 {
		t.Errorf("JavaVersion not populated: %+v", v.JavaVersion)
	}
}

func TestParseVersion_Inheritance(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	v, err := ParseVersion(mc, "1.14.4-forge-28.0.47", Platform{Name: "windows", Arch: "x64"})
	if err != nil {
		t.Fatalf("ParseVersion: %v", err)
	}
	if len(v.Inheritances) < 2 {
		t.Errorf("expected inheritance chain, got %v", v.Inheritances)
	}
	if v.Inheritances[0] != "1.14.4-forge-28.0.47" {
		t.Errorf("outer = %q", v.Inheritances[0])
	}
	last := v.Inheritances[len(v.Inheritances)-1]
	if last != "1.14.4" {
		t.Errorf("root = %q, want 1.14.4", last)
	}
}

func TestParseVersion_MissingMainClass(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	_, err := ParseVersion(mc, "no-main-class", Platform{Name: "windows", Arch: "x64"})
	if err == nil {
		t.Fatal("expected error")
	}
	var pe *ParseError
	if !errorsAs(err, &pe) || pe.Kind != "BadVersionJson" {
		t.Errorf("err kind = %v, want BadVersionJson", err)
	}
}

func TestParseVersion_MissingFile(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	_, err := ParseVersion(mc, "does-not-exist", Platform{Name: "windows", Arch: "x64"})
	if err == nil {
		t.Fatal("expected error")
	}
	var pe *ParseError
	if !errorsAs(err, &pe) || pe.Kind != "MissingVersionJson" {
		t.Errorf("err kind = %v, want MissingVersionJson", err)
	}
}

// ============================================================
// Launch argument assembly
// ============================================================

func TestGenerateArguments_Smoke(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	v, err := ParseVersion(mc, "1.14.4", Platform{Name: "windows", Arch: "x64"})
	if err != nil {
		t.Fatalf("ParseVersion: %v", err)
	}
	cmd, err := GenerateArguments(LaunchOption{
		ResolvedVersion: v,
		GamePath:        mockRoot(t),
		JavaPath:        "/path/to/java",
		Platform:        &Platform{Name: "windows", Arch: "x64"},
		MaxMemory:       4096,
		MinMemory:       1024,
	})
	if err != nil {
		t.Fatalf("GenerateArguments: %v", err)
	}
	if cmd[0] != "/path/to/java" {
		t.Errorf("cmd[0] = %q", cmd[0])
	}
	// Heap sizing flags must be present.
	if !sliceContains(cmd, "-Xmx4096M") {
		t.Errorf("missing -Xmx4096M: %v", cmd)
	}
	if !sliceContains(cmd, "-Xms1024M") {
		t.Errorf("missing -Xms1024M: %v", cmd)
	}
	// Main class shows up exactly once.
	mainClass := v.MainClass
	if mainClass == "" {
		t.Fatal("no main class")
	}
	count := 0
	for _, a := range cmd {
		if a == mainClass {
			count++
		}
	}
	if count != 1 {
		t.Errorf("main class count = %d, want 1", count)
	}
	// Classpath must include the version jar.
	wantJar := "versions/1.14.4/1.14.4.jar"
	foundJar := false
	for _, a := range cmd {
		if strings.Contains(a, wantJar) {
			foundJar = true
			break
		}
	}
	if !foundJar {
		t.Errorf("classpath missing %s", wantJar)
	}
}

func TestGenerateArguments_OmitsMxgWhenMaxMemorySet(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	v, _ := ParseVersion(mc, "1.14.4", Platform{Name: "linux", Arch: "x64"})
	cmd, err := GenerateArguments(LaunchOption{
		ResolvedVersion: v,
		GamePath:        mockRoot(t),
		JavaPath:        "java",
		Platform:        &Platform{Name: "linux", Arch: "x64"},
		MaxMemory:       2048,
	})
	if err != nil {
		t.Fatalf("GenerateArguments: %v", err)
	}
	// `-Xmx2G` from defaults must be filtered out — only `-Xmx2048M` (explicit) remains.
	for _, a := range cmd {
		if a == "-Xmx2G" {
			t.Errorf("expected default -Xmx2G to be dropped: %v", cmd)
			break
		}
	}
	if !sliceContains(cmd, "-Xmx2048M") {
		t.Errorf("missing explicit -Xmx2048M: %v", cmd)
	}
}

func TestGenerateArguments_TemplateSubstitution(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	v, _ := ParseVersion(mc, "1.14.4", Platform{Name: "linux", Arch: "x64"})
	cmd, err := GenerateArguments(LaunchOption{
		ResolvedVersion: v,
		GamePath:        "/tmp/instance",
		JavaPath:        "java",
		Platform:        &Platform{Name: "linux", Arch: "x64"},
		LauncherName:    "XMCL",
		LauncherBrand:   "1.0.0",
	})
	if err != nil {
		t.Fatalf("GenerateArguments: %v", err)
	}
	// `-Dminecraft.launcher.brand=...` must be substituted, not pass-through.
	for _, a := range cmd {
		if strings.Contains(a, "${launcher_name}") || strings.Contains(a, "${classpath}") {
			t.Errorf("unsubstituted template: %s", a)
		}
	}
	if !sliceContains(cmd, "-Dminecraft.launcher.brand=XMCL") &&
		!sliceContains(cmd, "-Dminecraft.launcher.brand=XMCL_INDIRECT") {
		// The TS / Go reference inserts the literal launcher name; we
		// look for `-Dminecraft.launcher.brand=...` containing XMCL.
		found := false
		for _, a := range cmd {
			if strings.HasPrefix(a, "-Dminecraft.launcher.brand=") &&
				strings.Contains(a, "XMCL") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("launcher brand not in cmd")
		}
	}
}

func TestResolveLibrary_Native(t *testing.T) {
	lib := Library{
		Name: "org.lwjgl:lwjgl:3.2.1",
		Downloads: &LibraryDownloads{
			Classifiers: map[string]*Artifact{
				"natives-windows": {
					Path:     "org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1-natives-windows.jar",
					Download: Download{SHA1: "abc"},
				},
			},
		},
		Natives: map[string]string{"windows": "natives-windows"},
	}
	resolved, native, ok := resolveLibrary(lib, Platform{Name: "windows", Arch: "x64"})
	if !ok {
		t.Fatal("native lib rejected")
	}
	if !native {
		t.Error("native flag not set")
	}
	if resolved.Classifier != "natives-windows" {
		t.Errorf("Classifier = %q", resolved.Classifier)
	}
}

func TestResolveLibrary_NativeFiltersWrongPlatform(t *testing.T) {
	lib := Library{
		Name:    "org.lwjgl:lwjgl:3.2.1",
		Natives: map[string]string{"windows": "natives-windows"},
	}
	_, _, ok := resolveLibrary(lib, Platform{Name: "linux", Arch: "x64"})
	if ok {
		t.Error("native should be dropped on linux when only `windows` mapping is declared")
	}
}

// ============================================================
// helpers
// ============================================================

func sliceContains(haystack []string, needle string) bool {
	for _, h := range haystack {
		if h == needle {
			return true
		}
	}
	return false
}

// errorsAs is a thin wrapper around errors.As — the call sites read
// more clearly with a custom name than an inline `*ParseError` declaration.
func errorsAs(err error, target **ParseError) bool {
	return errors.As(err, target)
}
