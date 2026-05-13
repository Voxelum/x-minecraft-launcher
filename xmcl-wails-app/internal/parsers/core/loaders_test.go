package core

import "testing"

func TestExtractLoaders_Vanilla(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	v, err := ParseVersion(mc, "1.14.4", Platform{Name: "windows", Arch: "x64"})
	if err != nil {
		t.Fatalf("ParseVersion: %v", err)
	}
	got := ExtractLoaders(v)
	if got.Minecraft != "1.14.4" {
		t.Errorf("Minecraft = %q", got.Minecraft)
	}
	if got.Forge != "" || got.Fabric != "" || got.Quilt != "" || got.NeoForged != "" || got.Optifine != "" || got.LabyMod != "" {
		t.Errorf("vanilla picked up loader bits: %+v", got)
	}
}

func TestExtractLoaders_Forge(t *testing.T) {
	mc := NewMinecraftFolder(mockRoot(t))
	v, err := ParseVersion(mc, "1.14.4-forge-28.0.47", Platform{Name: "windows", Arch: "x64"})
	if err != nil {
		t.Fatalf("ParseVersion: %v", err)
	}
	got := ExtractLoaders(v)
	if got.Minecraft != "1.14.4" {
		t.Errorf("Minecraft = %q, want 1.14.4", got.Minecraft)
	}
	if got.Forge == "" {
		t.Errorf("expected non-empty Forge: %+v", got)
	}
}

func TestFilterForgeVersion(t *testing.T) {
	cases := map[string]string{
		"1.14.4-28.0.47": "28.0.47",
		"28.0.47":        "28.0.47",
		"":               "",
	}
	for input, want := range cases {
		if got := FilterForgeVersion(input); got != want {
			t.Errorf("FilterForgeVersion(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestFilterOptifineVersion(t *testing.T) {
	// Mirrors the TS reference: strip everything up to and including
	// the first underscore. In practice the input always carries the
	// `<minecraft>_` prefix so this matches the renderer's expectation
	// of a bare classifier.
	cases := map[string]string{
		"1.21.8_HD_U_J6_pre16": "HD_U_J6_pre16",
		"HD_U_J6_pre16":        "U_J6_pre16",
		"":                     "",
	}
	for input, want := range cases {
		if got := FilterOptifineVersion(input); got != want {
			t.Errorf("FilterOptifineVersion(%q) = %q, want %q", input, got, want)
		}
	}
}
