package network

import (
	"reflect"
	"testing"
)

// bmcl is the canonical default mirror; reused by every test below.
var bmcl = APISet{Name: "bmcl", URL: DefaultBMCLAPI}

// helper: build a preference quickly.
func pref(preference string, gfw bool) MirrorPreference {
	return NewMirrorPreference(preference, []APISet{bmcl}, gfw)
}

func TestShouldOverride(t *testing.T) {
	cases := []struct {
		name       string
		preference string
		gfw        bool
		want       bool
	}{
		{"explicit-mojang", "mojang", true, false},
		{"explicit-bmcl", "bmcl", false, true},
		{"auto-outside-gfw", "", false, false},
		{"auto-inside-gfw", "", true, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := pref(tc.preference, tc.gfw).ShouldOverride()
			if got != tc.want {
				t.Fatalf("ShouldOverride: got %v want %v", got, tc.want)
			}
		})
	}
}

func TestAssetsURLs_BMCLFirst(t *testing.T) {
	got := pref("bmcl", false).AssetsURLs("ab", "abcd1234")
	want := []string{
		"https://bmclapi2.bangbang93.com/assets/ab/abcd1234",
		"https://resources.download.minecraft.net/ab/abcd1234",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("AssetsURLs: got %#v want %#v", got, want)
	}
}

func TestAssetsURLs_MojangFirst(t *testing.T) {
	got := pref("mojang", false).AssetsURLs("ab", "abcd1234")
	want := []string{
		"https://resources.download.minecraft.net/ab/abcd1234",
		"https://bmclapi2.bangbang93.com/assets/ab/abcd1234",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("AssetsURLs: got %#v want %#v", got, want)
	}
}

func TestLibraryURLs(t *testing.T) {
	upstream := "https://libraries.minecraft.net/com/mojang/foo/1.0/foo-1.0.jar"
	libPath := "com/mojang/foo/1.0/foo-1.0.jar"
	got := pref("bmcl", false).LibraryURLs(libPath, upstream)
	want := []string{
		"https://bmclapi2.bangbang93.com/maven/com/mojang/foo/1.0/foo-1.0.jar",
		upstream,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("LibraryURLs: got %#v want %#v", got, want)
	}
}

func TestForgeMavenURLs(t *testing.T) {
	libPath := "net/minecraftforge/forge/1.20.4-49.0.13/forge-1.20.4-49.0.13-installer.jar"
	got := pref("bmcl", false).ForgeMavenURLs(libPath)
	want := []string{
		"https://bmclapi2.bangbang93.com/maven/" + libPath,
		"https://maven.minecraftforge.net/" + libPath,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("ForgeMavenURLs: got %#v want %#v", got, want)
	}
}

func TestNeoForgeMavenURLs(t *testing.T) {
	libPath := "net/neoforged/neoforge/20.4.237/neoforge-20.4.237-installer.jar"
	got := pref("bmcl", false).NeoForgeMavenURLs(libPath)
	want := []string{
		"https://bmclapi2.bangbang93.com/maven/" + libPath,
		"https://maven.neoforged.net/releases/" + libPath,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("NeoForgeMavenURLs: got %#v want %#v", got, want)
	}
}

func TestMojangHostURLs(t *testing.T) {
	upstream := "https://launchermeta.mojang.com/v1/packages/abc/1.20.4.json"
	got := pref("bmcl", false).MojangHostURLs(upstream)
	want := []string{
		"https://bmclapi2.bangbang93.com/v1/packages/abc/1.20.4.json",
		upstream,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("MojangHostURLs: got %#v want %#v", got, want)
	}
}

func TestVersionManifestURLs(t *testing.T) {
	got := pref("bmcl", false).VersionManifestURLs()
	want := []string{
		"https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",
		"https://launchermeta.mojang.com/mc/game/version_manifest.json",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("VersionManifestURLs: got %#v want %#v", got, want)
	}
}

func TestFabricMetaURLs(t *testing.T) {
	got := pref("bmcl", false).FabricMetaURLs("/v2/versions/loader/1.20.4/0.16.5/profile/json")
	want := []string{
		"https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/1.20.4/0.16.5/profile/json",
		"https://meta.fabricmc.net/v2/versions/loader/1.20.4/0.16.5/profile/json",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("FabricMetaURLs: got %#v want %#v", got, want)
	}
}

func TestQuiltMetaURLs(t *testing.T) {
	got := pref("bmcl", false).QuiltMetaURLs("/v3/versions/loader/1.20.4/0.20.0/profile/json")
	want := []string{
		"https://bmclapi2.bangbang93.com/quilt-meta/v3/versions/loader/1.20.4/0.20.0/profile/json",
		"https://meta.quiltmc.org/v3/versions/loader/1.20.4/0.20.0/profile/json",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("QuiltMetaURLs: got %#v want %#v", got, want)
	}
}

func TestNoMirror_ChainStaysVanilla(t *testing.T) {
	// Empty preference + outside GFW + only the default bmcl set:
	// upstream comes first, mirror is still appended as a fallback.
	got := pref("", false).LibraryURLs("foo/1.0/foo-1.0.jar", "https://libraries.minecraft.net/foo/1.0/foo-1.0.jar")
	want := []string{
		"https://libraries.minecraft.net/foo/1.0/foo-1.0.jar",
		"https://bmclapi2.bangbang93.com/maven/foo/1.0/foo-1.0.jar",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("default-mirror chain: got %#v want %#v", got, want)
	}
}

func TestPreferredSetMovesToFront(t *testing.T) {
	custom := APISet{Name: "custom", URL: "https://example.cn"}
	p := NewMirrorPreference("custom", []APISet{bmcl, custom}, true)
	got := p.preferredSets()
	if len(got) != 2 || got[0].Name != "custom" {
		t.Fatalf("preferredSets: got %#v", got)
	}
}
