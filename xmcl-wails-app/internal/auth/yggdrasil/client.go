// Package yggdrasil ports the Yggdrasil (and authlib-injector flavour
// of) authentication client used by `packages/user/yggdrasil.ts`.
// All endpoints accept JSON over HTTPS; the TS side wraps fetch but
// the Go side talks directly to net/http.
package yggdrasil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/voxelum/xmcl/wails/internal/auth"
)

// Client is one Yggdrasil auth-server endpoint (`<base>/authserver`
// for authlib-injector, or the raw URL for the official-style API).
type Client struct {
	// Base is the auth server root (e.g. `https://authserver.ely.by/api/authserver`).
	Base string
	// HTTP is the underlying HTTP client. Defaults to auth.DefaultClient.
	HTTP *http.Client
}

// NewClient constructs a client from a base auth-server URL.
func NewClient(base string) *Client {
	return &Client{Base: strings.TrimRight(base, "/"), HTTP: auth.DefaultClient}
}

// NewAuthlibInjectorClient constructs a client for an authlib-injector
// service. The TS code maps `<root>` → `<root>/authserver` for the
// auth API; this helper does the same.
func NewAuthlibInjectorClient(root string) *Client {
	return NewClient(strings.TrimRight(root, "/") + "/authserver")
}

// AuthError carries the structured error body returned by Yggdrasil
// servers (`error`, `errorMessage`, `cause` per the Mojang protocol).
type AuthError struct {
	Status       int    `json:"-"`
	Error        string `json:"error"`
	ErrorMessage string `json:"errorMessage"`
	Cause        string `json:"cause,omitempty"`
}

func (e *AuthError) ErrorString() string {
	return e.Error + ": " + e.ErrorMessage
}

func (e *AuthError) ErrorImpl() string { return e.ErrorString() }

func (e *AuthError) Unwrap() error { return nil }

// Implement error.
// `*AuthError` itself can't satisfy `error` because the JSON `error`
// field shadows the method name, so we always go through the wrapper.
func (e *AuthError) Err() error { return e.AsError() }

func (e *AuthError) String() string { return e.ErrorString() }

// We can't have both Error string field and Error() method; rename via
// helper so the standard error interface is satisfied via wrapper.
type authErrWrapper struct{ inner *AuthError }

func (w *authErrWrapper) Error() string { return w.inner.ErrorString() }

// AsError boxes the AuthError into a standard error.
func (e *AuthError) AsError() error { return &authErrWrapper{inner: e} }

// Property is a Yggdrasil game-profile property (used for textures etc).
type Property struct {
	Name      string `json:"name"`
	Value     string `json:"value"`
	Signature string `json:"signature,omitempty"`
}

// GameProfile is the Yggdrasil game-profile shape.
type GameProfile struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Properties []Property `json:"properties,omitempty"`
}

// Authentication is the response shape of /authenticate and /refresh.
type Authentication struct {
	AccessToken       string         `json:"accessToken"`
	ClientToken       string         `json:"clientToken"`
	AvailableProfiles []GameProfile  `json:"availableProfiles"`
	SelectedProfile   *GameProfile   `json:"selectedProfile,omitempty"`
	User              map[string]any `json:"user,omitempty"`
}

// Login posts to /authenticate with username + password. requestUser=true
// asks the server to include the `user` block in the response.
func (c *Client) Login(ctx context.Context, username, password, clientToken string, requestUser bool) (*Authentication, error) {
	body := map[string]any{
		"agent":       map[string]any{"name": "Minecraft", "version": 1},
		"requestUser": requestUser,
		"username":    username,
		"password":    password,
		"clientToken": clientToken,
	}
	return c.postAuth(ctx, "/authenticate", body)
}

// Refresh posts to /refresh, exchanging an access token (+ optional
// client token) for a new access token.
func (c *Client) Refresh(ctx context.Context, accessToken, clientToken string, requestUser bool) (*Authentication, error) {
	body := map[string]any{
		"accessToken": accessToken,
		"clientToken": clientToken,
		"requestUser": requestUser,
	}
	return c.postAuth(ctx, "/refresh", body)
}

// Validate returns true when the (accessToken, clientToken) pair is
// still valid. The Yggdrasil server signals that with HTTP 204 / 2xx.
func (c *Client) Validate(ctx context.Context, accessToken, clientToken string) (bool, error) {
	body := map[string]any{
		"accessToken": accessToken,
		"clientToken": clientToken,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return false, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Base+"/validate",
		bytes.NewReader(raw))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := c.client().Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode >= 200 && resp.StatusCode < 300, nil
}

// Invalidate kills (accessToken, clientToken).
func (c *Client) Invalidate(ctx context.Context, accessToken, clientToken string) error {
	body := map[string]any{
		"accessToken": accessToken,
		"clientToken": clientToken,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Base+"/invalidate",
		bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := c.client().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

func (c *Client) postAuth(ctx context.Context, path string, body any) (*Authentication, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Base+path, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := c.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		ae := &AuthError{Status: resp.StatusCode}
		if strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") {
			_ = json.Unmarshal(respBody, ae)
		}
		if ae.Error == "" {
			ae.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
			ae.ErrorMessage = string(respBody)
		}
		return nil, ae.AsError()
	}
	var auth Authentication
	if err := json.Unmarshal(respBody, &auth); err != nil {
		return nil, fmt.Errorf("yggdrasil: decode %s: %w", path, err)
	}
	return &auth, nil
}

func (c *Client) client() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return auth.DefaultClient
}
