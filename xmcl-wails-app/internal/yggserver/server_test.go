package yggserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func newTestServer(t *testing.T, lookup Lookup) *Server {
	t.Helper()
	s := New(lookup)
	if _, err := s.Start("127.0.0.1:0"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func TestMetaEndpoint_ServesPublicKey(t *testing.T) {
	s := newTestServer(t, func(_ context.Context, _ string) *Profile { return nil })
	resp, err := http.Get(s.BaseURL())
	if err != nil {
		t.Fatalf("GET /yggdrasil: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var meta map[string]any
	if err := json.Unmarshal(body, &meta); err != nil {
		t.Fatalf("decode: %v", err)
	}
	pub, _ := meta["signaturePublickey"].(string)
	if !strings.Contains(pub, "BEGIN PUBLIC KEY") {
		t.Errorf("missing public key in metadata")
	}
}

func TestProfile_ReturnsTextureProperty(t *testing.T) {
	prof := &Profile{
		ID:   "abcd1234abcd1234abcd1234abcd1234",
		Name: "Steve",
		Textures: Textures{
			SKIN: &Texture{URL: "https://example.com/skin.png", Metadata: map[string]string{"model": "slim"}},
		},
	}
	s := newTestServer(t, func(_ context.Context, idOrName string) *Profile {
		if idOrName == prof.ID || strings.EqualFold(idOrName, "Steve") {
			return prof
		}
		return nil
	})

	resp, err := http.Get(s.BaseURL() + "/sessionserver/session/minecraft/profile/" + prof.ID + "?unsigned=false")
	if err != nil {
		t.Fatalf("GET profile: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var out struct {
		ID         string           `json:"id"`
		Name       string           `json:"name"`
		Properties []map[string]any `json:"properties"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.ID != prof.ID || out.Name != prof.Name {
		t.Errorf("identity mismatch: %+v", out)
	}
	var texturesProp map[string]any
	for _, p := range out.Properties {
		if p["name"] == "textures" {
			texturesProp = p
			break
		}
	}
	if texturesProp == nil {
		t.Fatal("missing textures property")
	}
	if _, ok := texturesProp["signature"].(string); !ok {
		t.Errorf("expected signature field for unsigned=false request")
	}
	encoded, _ := texturesProp["value"].(string)
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("base64: %v", err)
	}
	var ti texturesInfo
	if err := json.Unmarshal(raw, &ti); err != nil {
		t.Fatalf("decode textures: %v", err)
	}
	if ti.ProfileName != "Steve" {
		t.Errorf("profileName=%q want Steve", ti.ProfileName)
	}
	skin, ok := ti.Textures["SKIN"]
	if !ok {
		t.Fatal("missing SKIN texture entry")
	}
	if !strings.Contains(skin.URL, "/textures?href=") {
		t.Errorf("skin URL not proxied: %q", skin.URL)
	}
}

func TestHasJoined_NoMatch(t *testing.T) {
	s := newTestServer(t, func(_ context.Context, _ string) *Profile { return nil })
	resp, err := http.Get(s.BaseURL() + "/sessionserver/session/minecraft/hasJoined?username=Nobody")
	if err != nil {
		t.Fatalf("GET hasJoined: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("status = %d, want 204", resp.StatusCode)
	}
}

func TestJoinAlwaysReturns240(t *testing.T) {
	s := newTestServer(t, func(_ context.Context, _ string) *Profile { return nil })
	resp, err := http.Post(s.BaseURL()+"/sessionserver/session/minecraft/join",
		"application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatalf("POST join: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 240 {
		t.Errorf("status = %d, want 240", resp.StatusCode)
	}
}
