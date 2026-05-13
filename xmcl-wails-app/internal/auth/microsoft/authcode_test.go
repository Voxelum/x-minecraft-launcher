package microsoft

import (
	"crypto/sha256"
	"encoding/base64"
	"net/url"
	"strings"
	"testing"
)

func TestNewPKCE_VerifierAndChallenge(t *testing.T) {
	pair, err := NewPKCE()
	if err != nil {
		t.Fatalf("NewPKCE: %v", err)
	}
	if len(pair.Verifier) < 43 || len(pair.Verifier) > 128 {
		t.Errorf("verifier length out of RFC 7636 range: %d", len(pair.Verifier))
	}
	// Challenge must be BASE64URL(SHA256(verifier)) without padding.
	sum := sha256.Sum256([]byte(pair.Verifier))
	want := base64.RawURLEncoding.EncodeToString(sum[:])
	if pair.Challenge != want {
		t.Errorf("challenge mismatch: got %q want %q", pair.Challenge, want)
	}
	// Two calls produce different verifiers.
	pair2, _ := NewPKCE()
	if pair.Verifier == pair2.Verifier {
		t.Error("two PKCE pairs produced identical verifiers")
	}
}

func TestNewState_Unique(t *testing.T) {
	a, err := NewState()
	if err != nil {
		t.Fatalf("NewState: %v", err)
	}
	b, _ := NewState()
	if a == b {
		t.Error("two State() calls returned identical values")
	}
	if len(a) < 32 {
		t.Errorf("state too short: %d", len(a))
	}
}

func TestBuildAuthCodeURL_HasRequiredParams(t *testing.T) {
	c := NewClient()
	u := c.BuildAuthCodeURL(
		[]string{"XboxLive.signin", "offline_access"},
		"http://localhost:25555/auth",
		"challenge_xyz",
		"state_abc",
		"alice@example.com",
	)
	if !strings.HasPrefix(u, "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?") {
		t.Errorf("unexpected URL prefix: %s", u)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	q := parsed.Query()
	for _, key := range []string{
		"client_id", "response_type", "redirect_uri", "scope",
		"code_challenge", "code_challenge_method", "state", "login_hint",
	} {
		if q.Get(key) == "" {
			t.Errorf("missing required query param %q", key)
		}
	}
	if q.Get("code_challenge_method") != "S256" {
		t.Errorf("code_challenge_method=%q want S256", q.Get("code_challenge_method"))
	}
	if q.Get("scope") != "XboxLive.signin offline_access" {
		t.Errorf("scope=%q want space-joined", q.Get("scope"))
	}
}
