// Package microsoft ports the Microsoft → Xbox Live → Minecraft Services
// auth chain used by `packages/user/microsoft.ts` plus the device-code
// OAuth grant used by `xmcl-runtime/user/accountSystems/MicrosoftOAuthClient.ts`.
//
// We only support the **device-code** grant. The interactive auth-code
// flow MSAL implements relies on a localhost redirect server + token
// cache that's significantly more involved; the renderer already shows
// the device-code UI as the recommended path, so the auth-code flow
// can land in a later G7 follow-up.
package microsoft

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/voxelum/xmcl/wails/internal/auth"
)

// ClientID is the Azure AD application id used by the launcher.
// Mirrors xmcl-runtime/user/pluginOfficialUserApi.ts.
const ClientID = "1363d629-5b06-48a9-a5fb-c65de945f13e"

// MinecraftScope is the OAuth scope bag the launcher requests.
var MinecraftScope = []string{"XboxLive.signin", "offline_access"}

// DeviceCodeResponse mirrors the renderer's device-code event payload.
type DeviceCodeResponse struct {
	UserCode        string `json:"userCode"`
	DeviceCode      string `json:"deviceCode"`
	VerificationURI string `json:"verificationUri"`
	ExpiresIn       int    `json:"expiresIn"`
	Interval        int    `json:"interval"`
	Message         string `json:"message"`
}

// raw shape returned by Microsoft's devicecode endpoint.
type rawDeviceCodeResponse struct {
	UserCode        string `json:"user_code"`
	DeviceCode      string `json:"device_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
	Message         string `json:"message"`
}

// TokenResponse mirrors the OAuth2 token endpoint reply.
type TokenResponse struct {
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
	ExpiresIn    int    `json:"expires_in"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	IDToken      string `json:"id_token,omitempty"`
	// Error fields used when polling the device-code grant.
	Error            string `json:"error,omitempty"`
	ErrorDescription string `json:"error_description,omitempty"`
}

// Client speaks the Microsoft consumer OAuth + Xbox Live + Minecraft
// services surface used by the launcher.
type Client struct {
	HTTP     *http.Client
	ClientID string
}

// NewClient returns a client with the launcher's client id pre-filled.
func NewClient() *Client {
	return &Client{HTTP: auth.DefaultClient, ClientID: ClientID}
}

func (c *Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return auth.DefaultClient
}

func (c *Client) cid() string {
	if c.ClientID != "" {
		return c.ClientID
	}
	return ClientID
}

// ============================================================
// Device-code flow
// ============================================================

// StartDeviceCode requests a user / device code pair. The caller is
// expected to surface the returned `Message` (or `VerificationURI` +
// `UserCode`) to the user, then call PollDeviceCode in a goroutine.
func (c *Client) StartDeviceCode(ctx context.Context, scopes []string) (*DeviceCodeResponse, error) {
	form := url.Values{}
	form.Set("client_id", c.cid())
	form.Set("scope", strings.Join(scopes, " "))
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode",
		strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("microsoft devicecode: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var raw rawDeviceCodeResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("microsoft devicecode: decode: %w", err)
	}
	return &DeviceCodeResponse{
		UserCode:        raw.UserCode,
		DeviceCode:      raw.DeviceCode,
		VerificationURI: raw.VerificationURI,
		ExpiresIn:       raw.ExpiresIn,
		Interval:        raw.Interval,
		Message:         raw.Message,
	}, nil
}

// ErrAuthorizationPending is returned by PollDeviceCode while the user
// has not yet completed the grant. The caller should sleep and retry.
var ErrAuthorizationPending = errors.New("microsoft devicecode: authorization_pending")

// ErrAuthorizationDeclined is returned when the user explicitly declines
// or the device code expires.
var ErrAuthorizationDeclined = errors.New("microsoft devicecode: authorization_declined")

// ErrCodeExpired is returned when the device code expires without grant.
var ErrCodeExpired = errors.New("microsoft devicecode: code expired")

// PollDeviceCode does ONE token-endpoint poll. The caller wraps it in a
// loop with a `time.Ticker` whose interval matches the response's
// `interval` field (capped + slow_down adjusted by the caller).
func (c *Client) PollDeviceCode(ctx context.Context, deviceCode string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")
	form.Set("client_id", c.cid())
	form.Set("device_code", deviceCode)
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
	if resp.StatusCode == 200 {
		return &tok, nil
	}
	switch tok.Error {
	case "authorization_pending":
		return nil, ErrAuthorizationPending
	case "slow_down":
		// Caller is expected to widen the interval and retry; we map
		// to "pending" so the simple loop just waits one extra tick.
		return nil, ErrAuthorizationPending
	case "expired_token":
		return nil, ErrCodeExpired
	case "authorization_declined", "bad_verification_code":
		return nil, ErrAuthorizationDeclined
	}
	return nil, fmt.Errorf("microsoft devicecode: HTTP %d: %s: %s",
		resp.StatusCode, tok.Error, tok.ErrorDescription)
}

// AcquireDeviceCodeToken polls until the user completes the grant or
// the context is cancelled / the code expires. The interval is taken
// from `dc.Interval` (defaulting to 5s when zero).
func (c *Client) AcquireDeviceCodeToken(ctx context.Context, dc *DeviceCodeResponse) (*TokenResponse, error) {
	interval := dc.Interval
	if interval <= 0 {
		interval = 5
	}
	deadline := time.Now().Add(time.Duration(dc.ExpiresIn) * time.Second)
	for {
		if time.Now().After(deadline) {
			return nil, ErrCodeExpired
		}
		tok, err := c.PollDeviceCode(ctx, dc.DeviceCode)
		if err == nil {
			return tok, nil
		}
		if errors.Is(err, ErrAuthorizationPending) {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(interval) * time.Second):
				continue
			}
		}
		return nil, err
	}
}

// RefreshToken exchanges a refresh_token for a new access token.
func (c *Client) RefreshToken(ctx context.Context, refresh string, scopes []string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("client_id", c.cid())
	form.Set("refresh_token", refresh)
	form.Set("scope", strings.Join(scopes, " "))
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
		return nil, fmt.Errorf("microsoft refresh: HTTP %d: %s: %s",
			resp.StatusCode, tok.Error, tok.ErrorDescription)
	}
	return &tok, nil
}

// ============================================================
// Xbox Live + Minecraft chain
// ============================================================

// XBoxResponse is the wire shape of the Xbox Live + XSTS responses.
type XBoxResponse struct {
	IssueInstant  string `json:"IssueInstant"`
	NotAfter      string `json:"NotAfter"`
	Token         string `json:"Token"`
	DisplayClaims struct {
		Xui []struct {
			Uhs string `json:"uhs"`
			Xid string `json:"xid"`
			Gtg string `json:"gtg"`
		} `json:"xui"`
	} `json:"DisplayClaims"`
}

// AuthenticateXboxLive exchanges the MS access token for an Xbox Live
// user token (the "XBL" token).
func (c *Client) AuthenticateXboxLive(ctx context.Context, accessToken string) (*XBoxResponse, error) {
	body := map[string]any{
		"Properties": map[string]any{
			"AuthMethod": "RPS",
			"SiteName":   "user.auth.xboxlive.com",
			"RpsTicket":  "d=" + accessToken,
		},
		"RelyingParty": "http://auth.xboxlive.com",
		"TokenType":    "JWT",
	}
	return c.postJSON(ctx, "https://user.auth.xboxlive.com/user/authenticate", body)
}

// AuthorizeXboxLive exchanges an XBL token for an XSTS token. Pick
// `relyingParty` per the upstream flow: `rp://api.minecraftservices.com/`
// for the Minecraft chain or `http://xboxlive.com` for Xbox profile lookups.
func (c *Client) AuthorizeXboxLive(ctx context.Context, xblToken, relyingParty string) (*XBoxResponse, error) {
	if relyingParty == "" {
		relyingParty = "rp://api.minecraftservices.com/"
	}
	body := map[string]any{
		"Properties": map[string]any{
			"SandboxId":  "RETAIL",
			"UserTokens": []string{xblToken},
		},
		"RelyingParty": relyingParty,
		"TokenType":    "JWT",
	}
	return c.postJSON(ctx, "https://xsts.auth.xboxlive.com/xsts/authorize", body)
}

func (c *Client) postJSON(ctx context.Context, url string, body any) (*XBoxResponse, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("xbox: HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	var out XBoxResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, fmt.Errorf("xbox: decode: %w", err)
	}
	return &out, nil
}

// MinecraftAuthResponse mirrors the /authentication/login_with_xbox reply.
type MinecraftAuthResponse struct {
	Username    string `json:"username"`
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

// LoginMinecraftWithXbox exchanges an XSTS token + UHS for a Minecraft
// services bearer token.
func (c *Client) LoginMinecraftWithXbox(ctx context.Context, uhs, xstsToken string) (*MinecraftAuthResponse, error) {
	body := map[string]any{
		"identityToken": fmt.Sprintf("XBL3.0 x=%s;%s", uhs, xstsToken),
	}
	raw, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.minecraftservices.com/authentication/login_with_xbox",
		bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("login_with_xbox: HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	var out MinecraftAuthResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, fmt.Errorf("login_with_xbox: decode: %w", err)
	}
	return &out, nil
}

// MinecraftProfile mirrors `MicrosoftMinecraftProfile` from packages/user.
type MinecraftProfile struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Skins []struct {
		ID      string `json:"id"`
		State   string `json:"state"`
		URL     string `json:"url"`
		Variant string `json:"variant"`
	} `json:"skins"`
	Capes []struct {
		ID    string `json:"id"`
		State string `json:"state"`
		URL   string `json:"url"`
		Alias string `json:"alias,omitempty"`
	} `json:"capes"`
	Error           string `json:"error,omitempty"`
	ErrorMessage    string `json:"errorMessage,omitempty"`
	DeveloperMessage string `json:"developerMessage,omitempty"`
}

// GetMinecraftProfile returns the player's MC services profile (skins
// + capes + UUID + name).
func (c *Client) GetMinecraftProfile(ctx context.Context, mcAccessToken string) (*MinecraftProfile, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.minecraftservices.com/minecraft/profile", nil)
	req.Header.Set("Authorization", "Bearer "+mcAccessToken)
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var prof MinecraftProfile
	_ = json.Unmarshal(body, &prof)
	if resp.StatusCode == 200 {
		return &prof, nil
	}
	if prof.ErrorMessage == "" {
		prof.ErrorMessage = string(body)
	}
	return nil, fmt.Errorf("mc profile: HTTP %d: %s", resp.StatusCode, prof.ErrorMessage)
}
