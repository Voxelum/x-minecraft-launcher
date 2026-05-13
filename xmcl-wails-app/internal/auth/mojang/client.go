// Package mojang ports the small subset of the Microsoft / Mojang
// services API used by `xmcl-runtime/user/OfficialUserService.ts`.
// All endpoints take a Minecraft services bearer token (acquired via
// the microsoft package's full chain) in the Authorization header.
package mojang

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/voxelum/xmcl/wails/internal/auth"
)

// Client is the Mojang services REST adapter.
type Client struct {
	HTTP *http.Client
}

// NewClient returns a Mojang client backed by auth.DefaultClient.
func NewClient() *Client { return &Client{HTTP: auth.DefaultClient} }

func (c *Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return auth.DefaultClient
}

// SetName changes the player's MC services display name.
func (c *Client) SetName(ctx context.Context, name, token string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut,
		"https://api.minecraftservices.com/minecraft/profile/name/"+name, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return c.discardOK(req)
}

// NameChangeInformation mirrors the MS / Mojang reply.
type NameChangeInformation struct {
	ChangedAt         string `json:"changedAt"`
	CreatedAt         string `json:"createdAt"`
	NameChangeAllowed bool   `json:"nameChangeAllowed"`
}

// GetNameChangeInformation returns the eligibility info for renames.
func (c *Client) GetNameChangeInformation(ctx context.Context, token string) (*NameChangeInformation, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.minecraftservices.com/minecraft/profile/namechange", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("getNameChangeInformation: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var out NameChangeInformation
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CheckNameAvailability returns one of "AVAILABLE", "DUPLICATE", "NOT_ALLOWED", …
func (c *Client) CheckNameAvailability(ctx context.Context, name, token string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.minecraftservices.com/minecraft/profile/name/"+name+"/available", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var raw struct {
		Status string `json:"status"`
	}
	_ = json.Unmarshal(body, &raw)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("checkNameAvailability: HTTP %d: %s", resp.StatusCode, string(body))
	}
	return raw.Status, nil
}

// HideCape removes the active cape.
func (c *Client) HideCape(ctx context.Context, token string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete,
		"https://api.minecraftservices.com/minecraft/profile/capes/active", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return c.discardOK(req)
}

// ShowCape activates the cape with id `capeId`.
func (c *Client) ShowCape(ctx context.Context, capeID, token string) error {
	body, _ := json.Marshal(map[string]string{"capeId": capeID})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut,
		"https://api.minecraftservices.com/minecraft/profile/capes/active",
		bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return c.discardOK(req)
}

// VerifySecurityLocation hits the legacy api.mojang.com endpoint that
// reports whether the caller is logging in from a "trusted" device.
// Modern Microsoft accounts always 410 / 404 here — we surface that as
// `false` so the renderer falls back to the security challenge flow.
func (c *Client) VerifySecurityLocation(ctx context.Context, token string) (bool, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.mojang.com/user/security/location", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http().Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode == 204, nil
}

// MojangChallenge mirrors xmcl-runtime-api MojangChallenge.
type MojangChallenge struct {
	Answer   map[string]any `json:"answer"`
	Question map[string]any `json:"question"`
}

// MojangChallengeResponse mirrors xmcl-runtime-api MojangChallengeResponse.
type MojangChallengeResponse struct {
	ID     float64 `json:"id"`
	Answer string  `json:"answer"`
}

// GetSecurityChallenges returns the legacy Mojang security challenges.
func (c *Client) GetSecurityChallenges(ctx context.Context, token string) ([]MojangChallenge, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.mojang.com/user/security/challenges", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("getSecurityChallenges: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var out []MojangChallenge
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// SubmitSecurityChallenges posts back the user's answers.
func (c *Client) SubmitSecurityChallenges(ctx context.Context, answers []MojangChallengeResponse, token string) error {
	body, _ := json.Marshal(answers)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.mojang.com/user/security/location",
		bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == 204 {
		return nil
	}
	return fmt.Errorf("submitSecurityChallenges: HTTP %d: %s", resp.StatusCode, string(respBody))
}

func (c *Client) discardOK(req *http.Request) error {
	resp, err := c.http().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
}
