// Package modrinth ports the small auth surface of `xmcl-runtime/user/utils/loginModrinth.ts`.
//
// Flow:
//
//  1. Call `BuildAuthorizeURL(redirectURI, scopes)` to derive the URL
//     the renderer should open in a browser.
//  2. Use the shared `authcallback` package to capture the resulting
//     `?code=...` redirect on a localhost listener.
//  3. Call `Client.Exchange(...)` to swap the code for an access token
//     via the launcher's hosted exchange endpoint
//     (`https://api.xmcl.app/modrinth/auth`). The endpoint hides the
//     OAuth client_secret server-side, matching the TS impl.
//
// The bearer token is what every Modrinth REST call (the renderer's
// market views) rides under `Authorization: <token>`. It is **not**
// prefixed with `Bearer`; that matches the legacy Electron behaviour
// per `pluginModrinthAccess.ts`.
package modrinth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/auth"
)

// ClientID is the public OAuth application id registered for XMCL.
// Mirrors xmcl-runtime/user/utils/loginModrinth.ts.
const ClientID = "GFz0B21y"

// AuthorizeEndpoint is the consent page the user is redirected to.
const AuthorizeEndpoint = "https://modrinth.com/auth/authorize"

// ExchangeEndpoint is the launcher's hosted code-exchange proxy.
// We POST through it (instead of talking directly to Modrinth's token
// endpoint) so the OAuth client_secret stays server-side.
const ExchangeEndpoint = "https://api.xmcl.app/modrinth/auth"

// DefaultScopes mirrors the ones requested by the TS impl when the
// renderer kicks off `loginModrinth()`.
var DefaultScopes = []string{
	"USER_READ_EMAIL",
	"USER_READ",
	"USER_WRITE",
	"COLLECTION_CREATE",
	"COLLECTION_READ",
	"COLLECTION_WRITE",
	"COLLECTION_DELETE",
}

// Token is the persisted shape of the exchange response.
//
// The TS impl adds an `issued_at` field on the client side so it can
// compute expiration locally; we keep the same convention so cross-
// build keyring data stays compatible.
type Token struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
	IssuedAt    int64  `json:"issued_at,omitempty"`
}

// Valid reports whether the token's wall-clock expiration is in the
// future given `nowMillis`. Tokens without an issued_at stamp (legacy
// data) are considered valid; the API call will fail naturally if not.
func (t Token) Valid(nowMillis int64) bool {
	if t.IssuedAt == 0 {
		return true
	}
	return nowMillis < t.IssuedAt+int64(t.ExpiresIn)*1000
}

// Client is the Modrinth OAuth helper. Stateless; safe to share.
type Client struct {
	HTTP *http.Client
}

// NewClient returns a Client backed by the shared auth.DefaultClient.
func NewClient() *Client { return &Client{HTTP: auth.DefaultClient} }

func (c *Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return auth.DefaultClient
}

// BuildAuthorizeURL returns the consent URL. Scopes are space-joined.
// `redirectURI` must match one configured for the Modrinth app
// (currently `http://127.0.0.1:25555/modrinth-auth`).
func BuildAuthorizeURL(redirectURI string, scopes []string) string {
	q := url.Values{}
	q.Set("client_id", ClientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("scope", strings.Join(scopes, " "))
	return AuthorizeEndpoint + "?" + q.Encode()
}

// Exchange swaps the auth code for a Token via the launcher's hosted
// proxy. Returns an error when the proxy reports a non-2xx status or
// the body fails to decode.
func (c *Client) Exchange(ctx context.Context, code, redirectURI string) (*Token, error) {
	q := url.Values{}
	q.Set("code", code)
	q.Set("redirect_uri", redirectURI)
	endpoint := ExchangeEndpoint + "?" + q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("modrinth exchange: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var tok Token
	if err := json.Unmarshal(body, &tok); err != nil {
		return nil, fmt.Errorf("modrinth exchange: decode: %w", err)
	}
	if tok.AccessToken == "" {
		return nil, fmt.Errorf("modrinth exchange: empty access_token in response")
	}
	return &tok, nil
}
