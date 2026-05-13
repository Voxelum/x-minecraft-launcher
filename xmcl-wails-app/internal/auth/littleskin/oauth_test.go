package littleskin

import (
	"net/url"
	"strings"
	"testing"
)

func TestBuildAuthorizeURL_HasRequiredParams(t *testing.T) {
	u := BuildAuthorizeURL("state-xyz")
	if !strings.HasPrefix(u, AuthorizeEndpoint+"?") {
		t.Fatalf("unexpected prefix: %s", u)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	q := parsed.Query()
	for _, key := range []string{"client_id", "redirect_uri", "response_type", "scope", "state"} {
		if q.Get(key) == "" {
			t.Errorf("missing %q param", key)
		}
	}
	if q.Get("client_id") != LittleSkinClientID {
		t.Errorf("client_id=%q want %s", q.Get("client_id"), LittleSkinClientID)
	}
	if q.Get("redirect_uri") != LittleSkinRedirectURI {
		t.Errorf("redirect_uri=%q want %s", q.Get("redirect_uri"), LittleSkinRedirectURI)
	}
	if q.Get("state") != "state-xyz" {
		t.Errorf("state mismatch: %q", q.Get("state"))
	}
}

func TestBuildAuthorizeURL_OptionalState(t *testing.T) {
	u := BuildAuthorizeURL("")
	parsed, _ := url.Parse(u)
	if parsed.Query().Has("state") {
		t.Errorf("state should be omitted when empty: %s", u)
	}
}
