// LittleSkin OAuth — authorization-code grant.
//
// LittleSkin's OAuth endpoints are documented at
//   https://github.com/bs-community/skin-server-oauth
// The launcher's registered application is `client_id=393` with the
// (publicly known) `client_secret` baked in to the Electron build.
// Both values are inherited from `xmcl-runtime/littleSkin/LittleSkinUserService.ts`.
//
// Token exchange happens after the OAuth callback delivers `?code=...`
// to a localhost listener (handled by the `authcallback` package).

package littleskin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const (
	// LittleSkinClientID is the public OAuth client id of XMCL.
	LittleSkinClientID = "393"
	// LittleSkinClientSecret is the public-knowledge client secret.
	// Mirrors xmcl-runtime/littleSkin/LittleSkinUserService.ts.
	LittleSkinClientSecret = "pGmFutnvu1H3eHfqJC8l80CYcCtjk3p4ykZaUzJW"

	// LittleSkinRedirectURI must match the URI registered for client 393.
	// LittleSkin currently expects `http://localhost:25555/littleskin`.
	LittleSkinRedirectURI = "http://localhost:25555/littleskin"

	// AuthorizeEndpoint is the browser-facing entry of the auth flow.
	AuthorizeEndpoint = "https://littleskin.cn/oauth/authorize"
	// TokenEndpoint exchanges the auth code for a bearer token.
	TokenEndpoint = "https://littleskin.cn/oauth/token"

	// LittleSkinTokenService / LittleSkinTokenAccount are the
	// OS-keyring slots the LittleSkinUserService writes the bearer
	// token to. Other services (e.g. UserService.UploadSkin) read
	// from the same slot when the user's authority resolves to a
	// LittleSkin authlib-injector entry.
	LittleSkinTokenService = "xmcl/littleskin.cn"
	LittleSkinTokenAccount = "default"
)

// BuildAuthorizeURL returns the URL the user should be redirected to
// in their browser. `state` is forwarded back as a query parameter so
// the caller can dedupe concurrent attempts.
func BuildAuthorizeURL(state string) string {
	q := url.Values{}
	q.Set("client_id", LittleSkinClientID)
	q.Set("redirect_uri", LittleSkinRedirectURI)
	q.Set("response_type", "code")
	q.Set("scope", "User.Read Player.Read Closet.Read Closet.Write")
	if state != "" {
		q.Set("state", state)
	}
	return AuthorizeEndpoint + "?" + q.Encode()
}

// TokenResponse mirrors the OAuth2 token endpoint reply.
type TokenResponse struct {
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// ExchangeCode trades an authorization code for a TokenResponse.
func (c *Client) ExchangeCode(ctx context.Context, code string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("client_id", LittleSkinClientID)
	form.Set("client_secret", LittleSkinClientSecret)
	form.Set("redirect_uri", LittleSkinRedirectURI)
	form.Set("code", code)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, TokenEndpoint,
		strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("littleskin token exchange: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var tok TokenResponse
	if err := json.Unmarshal(body, &tok); err != nil {
		return nil, fmt.Errorf("littleskin token exchange: decode: %w", err)
	}
	if tok.AccessToken == "" {
		return nil, fmt.Errorf("littleskin token exchange: empty access_token: %s", string(body))
	}
	return &tok, nil
}

// SetCharacterName renames a character. The TS contract reuses the
// SetCharacterTextureOptions shape (sans the texture fields), so the
// caller must pass the new name out-of-band; we expose it here so
// the LittleSkinUserService can wire it in.
func (c *Client) SetCharacterNameWithName(ctx context.Context, pid float64, name, token string) error {
	u := fmt.Sprintf("%s/api/players/%v/name?name=%s", baseURL, pid, url.QueryEscape(name))
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, u, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return c.discardOK(req)
}
