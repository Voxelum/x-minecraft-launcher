package javaparse

import "testing"

func TestParse_LegacyJDK8(t *testing.T) {
	in := `java version "1.8.0_312"
Java(TM) SE Runtime Environment (build 1.8.0_312-b07)
Java HotSpot(TM) 64-Bit Server VM (build 25.312-b07, mixed mode)`
	got := Parse(in)
	if got == nil {
		t.Fatal("expected info, got nil")
	}
	if got.MajorVersion != 8 {
		t.Errorf("major = %d, want 8", got.MajorVersion)
	}
	if got.Patch != 312 {
		t.Errorf("patch = %d, want 312", got.Patch)
	}
}

func TestParse_OpenJDK11(t *testing.T) {
	in := `openjdk version "11.0.21" 2023-10-17
OpenJDK Runtime Environment Temurin-11.0.21+9 (build 11.0.21+9)
OpenJDK 64-Bit Server VM Temurin-11.0.21+9 (build 11.0.21+9, mixed mode)`
	got := Parse(in)
	if got == nil {
		t.Fatal("expected info")
	}
	if got.MajorVersion != 11 {
		t.Errorf("major = %d, want 11", got.MajorVersion)
	}
	if got.Patch != 21 {
		t.Errorf("patch = %d, want 21", got.Patch)
	}
}

func TestParse_MajorOnlyOpenJDK(t *testing.T) {
	in := `openjdk version "25" 2025-09-16`
	got := Parse(in)
	if got == nil {
		t.Fatal("expected info")
	}
	if got.MajorVersion != 25 {
		t.Errorf("major = %d, want 25", got.MajorVersion)
	}
}

func TestParse_MajorOnlyOracle(t *testing.T) {
	in := `java version "25" 2025-09-16 LTS`
	got := Parse(in)
	if got == nil {
		t.Fatal("expected info")
	}
	if got.MajorVersion != 25 {
		t.Errorf("major = %d", got.MajorVersion)
	}
}

func TestParse_Garbage(t *testing.T) {
	if Parse("not a version") != nil {
		t.Error("expected nil for garbage input")
	}
	if Parse("") != nil {
		t.Error("expected nil for empty")
	}
}

func TestParse_Java17(t *testing.T) {
	in := `openjdk version "17.0.9" 2023-10-17
OpenJDK Runtime Environment Temurin-17.0.9+9
OpenJDK 64-Bit Server VM Temurin-17.0.9+9`
	got := Parse(in)
	if got == nil || got.MajorVersion != 17 || got.Patch != 9 {
		t.Errorf("got = %+v", got)
	}
}
