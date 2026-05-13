package modrinth

import (
	"net/url"
	"strings"
	"testing"
)

func TestBuildAuthorizeURL_HasParams(t *testing.T) {
	u := BuildAuthorizeURL("http://127.0.0.1:25555/modrinth-auth", DefaultScopes)
	if !strings.HasPrefix(u, AuthorizeEndpoint+"?") {
		t.Fatalf("unexpected prefix: %s", u)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	q := parsed.Query()
	for _, key := range []string{"client_id", "redirect_uri", "scope"} {
		if q.Get(key) == "" {
			t.Errorf("missing %q", key)
		}
	}
	if q.Get("client_id") != ClientID {
		t.Errorf("client_id=%q want %q", q.Get("client_id"), ClientID)
	}
	scope := q.Get("scope")
	for _, want := range DefaultScopes {
		if !strings.Contains(scope, want) {
			t.Errorf("scope missing %q: %q", want, scope)
		}
	}
}

func TestTokenValid(t *testing.T) {
	cases := []struct {
		name  string
		tok   Token
		now   int64
		valid bool
	}{
		{"no issued_at => assume valid", Token{ExpiresIn: 3600}, 1_700_000_000_000, true},
		{"in window", Token{ExpiresIn: 3600, IssuedAt: 1_700_000_000_000}, 1_700_000_500_000, true},
		{"past expiration", Token{ExpiresIn: 3600, IssuedAt: 1_700_000_000_000}, 1_700_000_000_000 + 3601*1000, false},
		{"exactly at expiration", Token{ExpiresIn: 3600, IssuedAt: 1_700_000_000_000}, 1_700_000_000_000 + 3600*1000, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := c.tok.Valid(c.now); got != c.valid {
				t.Errorf("Valid(%d)=%v want %v", c.now, got, c.valid)
			}
		})
	}
}
