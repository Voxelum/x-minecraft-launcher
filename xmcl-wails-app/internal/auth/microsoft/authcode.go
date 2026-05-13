// Auth-code flow helpers for the Microsoft OAuth client.
//
// The flow runs renderer-side as:
//
//  1. UserService starts a one-shot localhost HTTP listener on
//     `redirectURI`'s host:port.
//  2. UserService opens `BuildAuthCodeURL(...)` in the user's browser.
//  3. Microsoft redirects back to the listener with `?code=…`.
//  4. UserService calls `ExchangeAuthCode(...)` with the captured code
//     plus the original PKCE verifier, completing the grant.
//
// Mirrors the auth-code branch of
// `xmcl-runtime/user/accountSystems/MicrosoftOAuthClient.ts` (which
// uses MSAL under the hood). We don't ship a token cache yet — refresh
// tokens are persisted via the OS keyring by UserService.

package microsoft

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// PKCEPair carries the verifier + the URL-safe challenge derived from
// it. Pass `Verifier` back to ExchangeAuthCode after you receive the
// authorization code.
type PKCEPair struct {
	Verifier  string
	Challenge string
}

// NewPKCE generates a fresh (verifier, S256-challenge) pair per RFC 7636.
func NewPKCE() (PKCEPair, error) {
	// 32 random bytes → 43-char URL-safe verifier.
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return PKCEPair{}, err
	}
	verifier := base64.RawURLEncoding.EncodeToString(buf)
	sum := sha256.Sum256([]byte(verifier))
	return PKCEPair{
		Verifier:  verifier,
		Challenge: base64.RawURLEncoding.EncodeToString(sum[:]),
	}, nil
}

// NewState returns 32 bytes of CSRF state encoded as URL-safe base64.
func NewState() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// BuildAuthCodeURL returns the authorization endpoint URL the user
// must be sent to. `loginHint` is optional (empty string skips it).
func (c *Client) BuildAuthCodeURL(scopes []string, redirectURI, codeChallenge, state, loginHint string) string {
	q := url.Values{}
	q.Set("client_id", c.cid())
	q.Set("response_type", "code")
	q.Set("redirect_uri", redirectURI)
	q.Set("response_mode", "query")
	q.Set("scope", strings.Join(scopes, " "))
	q.Set("code_challenge", codeChallenge)
	q.Set("code_challenge_method", "S256")
	q.Set("state", state)
	if loginHint != "" {
		q.Set("login_hint", loginHint)
	}
	return "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?" + q.Encode()
}

// ExchangeAuthCode trades (code, verifier) for a TokenResponse.
func (c *Client) ExchangeAuthCode(ctx context.Context, code, codeVerifier, redirectURI string, scopes []string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("client_id", c.cid())
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("code_verifier", codeVerifier)
	if len(scopes) > 0 {
		form.Set("scope", strings.Join(scopes, " "))
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
		strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var tok TokenResponse
	_ = json.Unmarshal(body, &tok)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("microsoft authcode: HTTP %d: %s: %s",
			resp.StatusCode, tok.Error, tok.ErrorDescription)
	}
	return &tok, nil
}
