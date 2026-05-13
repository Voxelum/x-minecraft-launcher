package gamesetting

import (
	"strings"
	"testing"
)

const sampleOptions = `
version:512
invertYMouse:false
mouseSensitivity:0.47887325
fov:0.0
gamma:1.0
saturation:0.0
renderDistance:12
guiScale:0
particles:1
bobView:true
anaglyph3d:false
maxFps:120
fboEnable:true
difficulty:1
fancyGraphics:false
ao:1
renderClouds:false
resourcePacks:["Xray Ultimate 1.12 v2.2.1.zip","fabric:abc"]
incompatibleResourcePacks:[]
lastServer:play.mcndsj.com
lang:en_US
chatVisibility:0
chatColors:true
chatLinks:true
chatLinksPrompt:true
chatOpacity:1.0
snooperEnabled:true
fullscreen:false
enableVsync:true
useVbo:true
mainHand:right
modelPart_hat:true
`

func TestParse_AllOptions(t *testing.T) {
	set := Parse(sampleOptions)

	if got := set.Int("ao", -1); got != 1 {
		t.Errorf("ao = %d, want 1", got)
	}
	if got := set.Float("fov", -1); got != 0 {
		t.Errorf("fov = %v, want 0", got)
	}
	if got := set.Int("difficulty", -1); got != 1 {
		t.Errorf("difficulty = %d, want 1", got)
	}
	if got := set.Bool("renderClouds", true); got != false {
		t.Errorf("renderClouds = %v, want false", got)
	}
	if got := set.Bool("fancyGraphics", true); got != false {
		t.Errorf("fancyGraphics = %v, want false", got)
	}
	if got := set.String("lastServer", ""); got != "play.mcndsj.com" {
		t.Errorf("lastServer = %q, want %q", got, "play.mcndsj.com")
	}
	if got := set.Int("particles", -1); got != 1 {
		t.Errorf("particles = %d, want 1", got)
	}
	if got := set.String("lang", ""); got != "en_US" {
		t.Errorf("lang = %q, want %q", got, "en_US")
	}
	if got := set.Bool("modelPart_hat", false); got != true {
		t.Errorf("modelPart_hat = %v, want true", got)
	}
	rp := set.Strings("resourcePacks")
	want := []string{"Xray Ultimate 1.12 v2.2.1.zip", "fabric:abc"}
	if len(rp) != len(want) || rp[0] != want[0] || rp[1] != want[1] {
		t.Errorf("resourcePacks = %v, want %v", rp, want)
	}
}

func TestParse_EmptyInput(t *testing.T) {
	set := Parse("")
	if len(set) != 0 {
		t.Errorf("Parse(\"\") = %v, want empty", set)
	}
}

func TestParse_IllegalKey(t *testing.T) {
	// An `undefined:undefined` line should still parse (TS strict mode
	// drops unknown keys, but the Go API doesn't have a strict mode —
	// callers can prune by walking the map).
	set := Parse("undefined:undefined")
	if got, ok := set["undefined"]; !ok || got != "undefined" {
		t.Errorf("set[undefined] = %v, ok=%v", got, ok)
	}
}

func TestStringify_BasicFields(t *testing.T) {
	setting := Frame{
		"useVbo":         false,
		"fboEnable":      false,
		"enableVsync":    false,
		"fancyGraphics":  false,
		"renderClouds":   false,
		"forceUnicodeFont": false,
		"autoJump":       false,
		"entityShadows":  false,
		"ao":             int64(0),
		"fov":            float64(0),
		"mipmapLevels":   int64(0),
		"maxFps":         int64(0),
		"particles":      int64(0),
		"renderDistance": int64(2),
		"resourcePacks":  []string{"asb"},
	}
	out := Stringify(setting, "", "")
	mustContain(t, out, "maxFps:0")
	mustContain(t, out, "fboEnable:false")
	mustContain(t, out, "enableVsync:false")
	mustContain(t, out, "fancyGraphics:false")
	mustContain(t, out, `resourcePacks:["asb"]`)
}

func TestStringify_EmptyArray(t *testing.T) {
	setting := Frame{
		"resourcePacks": []string{},
	}
	out := Stringify(setting, "", "")
	mustContain(t, out, "resourcePacks:[]")
}

func TestStringify_DropsUndefined(t *testing.T) {
	setting := Frame{
		"undefined": nil,
	}
	out := Stringify(setting, "", "")
	if strings.Contains(out, "undefined:") {
		t.Errorf("expected no undefined:, got %q", out)
	}
}

func TestArrays_JSONUnicodeEscape(t *testing.T) {
	// What stringify() produces for a resource pack name containing `§`.
	text := `resourcePacks:["xali\u00a7r-enchanted-books.zip"]`
	set := Parse(text)
	rp := set.Strings("resourcePacks")
	want := "xali§r-enchanted-books.zip"
	if len(rp) != 1 || rp[0] != want {
		t.Errorf("resourcePacks = %v, want [%q]", rp, want)
	}
}

func TestArrays_RoundTripStableForSpecialChars(t *testing.T) {
	original := Frame{
		"resourcePacks": []string{"xali§r-enchanted-books.zip", "plain.zip"},
	}
	first := Stringify(original, "", "")
	text := first
	for i := 0; i < 5; i++ {
		parsed := Parse(text)
		next := Stringify(parsed, "", "")
		if next != text {
			t.Fatalf("iter %d not stable\nbefore: %q\nafter:  %q", i, text, next)
		}
		text = next
	}
}

func TestArrays_UnquotedMMCStyle(t *testing.T) {
	set := Parse("resourcePacks:[foo,bar baz]")
	rp := set.Strings("resourcePacks")
	if len(rp) != 2 || rp[0] != "foo" || rp[1] != "bar baz" {
		t.Errorf("resourcePacks = %v, want [foo bar baz]", rp)
	}
}

func TestArrays_Empty(t *testing.T) {
	set := Parse("incompatibleResourcePacks:[]")
	rp := set.Strings("incompatibleResourcePacks")
	if rp == nil {
		// Coerce the nil-map vs empty-slice ambiguity.
		rp = []string{}
	}
	if len(rp) != 0 {
		t.Errorf("incompatibleResourcePacks = %v, want []", rp)
	}
}

func TestArrays_NoBackslashDoubling(t *testing.T) {
	// `a\\b.zip` on disk decodes to a single backslash.
	text := `resourcePacks:["a\\b.zip"]`
	set := Parse(text)
	rp := set.Strings("resourcePacks")
	want := `a\b.zip`
	if len(rp) != 1 || rp[0] != want {
		t.Errorf("resourcePacks = %v, want [%q]", rp, want)
	}
}

func mustContain(t *testing.T, haystack, needle string) {
	t.Helper()
	if !strings.Contains(haystack, needle) {
		t.Errorf("expected %q to contain %q\nfull: %q", haystack, needle, haystack)
	}
}
