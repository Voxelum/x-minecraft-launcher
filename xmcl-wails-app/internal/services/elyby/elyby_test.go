package elyby

import (
	"strings"
	"testing"
)

func TestPrimaryVersion(t *testing.T) {
	cases := map[string]string{
		"1.20.4":   "1.20",
		"1.20":     "1.20",
		"1.21.2":   "1.21",
		"1.7.10":   "1.7",
		"snapshot": "snapshot",
	}
	for in, want := range cases {
		if got := primaryVersion(in); got != want {
			t.Errorf("primaryVersion(%q)=%q want %q", in, got, want)
		}
	}
}

func TestEmbeddedCacheParses(t *testing.T) {
	entries, err := parseMetaEntries(embeddedCacheJSON)
	if err != nil {
		t.Fatalf("parse embedded cache: %v", err)
	}
	if len(entries) < 5 {
		t.Fatalf("embedded cache too small: %d entries", len(entries))
	}
	// Spot-check the first entry — the cache is hand-curated.
	first := entries[0]
	if first.Minecraft == "" || first.ID == "" {
		t.Errorf("first entry missing fields: %+v", first)
	}
	// Verify at least one entry mentions "authlib" so we know the
	// embed actually ships the right file.
	found := false
	for _, e := range entries {
		if strings.Contains(e.ID, "authlib") {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("embedded cache contains no authlib id; wrong file embedded?")
	}
}
