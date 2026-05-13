// Package littleskin ports xmcl-runtime/littleSkin/LittleSkinClient.ts.
// LittleSkin's REST API is plain JSON over HTTPS with a Bearer token
// header. We only port the endpoints actually exposed through the
// renderer-facing service contract.
package littleskin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/voxelum/xmcl/wails/internal/auth"
)

const baseURL = "https://littleskin.cn/api"

// Client is the LittleSkin REST adapter.
type Client struct {
	HTTP *http.Client
}

// NewClient returns a LittleSkin client backed by auth.DefaultClient.
func NewClient() *Client { return &Client{HTTP: auth.DefaultClient} }

func (c *Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return auth.DefaultClient
}

// Character mirrors xmcl-runtime-api LittleSkinCharacter.
type Character struct {
	PID          float64 `json:"pid"`
	UID          float64 `json:"uid"`
	Name         string  `json:"name"`
	TIDSkin      float64 `json:"tid_skin"`
	TIDCape      float64 `json:"tid_cape"`
	LastModified string  `json:"last_modified"`
}

// SetCharacterTextureOptions mirrors the contract type.
type SetCharacterTextureOptions struct {
	PID  float64
	Skin *float64
	Cape *float64
}

// GetAllCharacters returns the player's closet contents.
func (c *Client) GetAllCharacters(ctx context.Context, token string) ([]Character, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/closet", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("littleskin GetAllCharacters: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var out []Character
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// SetCharacterName renames a character.
func (c *Client) SetCharacterName(ctx context.Context, pid float64, name, token string) error {
	u := fmt.Sprintf("%s/api/players/%v/name?name=%s", baseURL, pid, url.QueryEscape(name))
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, u, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return c.discardOK(req)
}

// SetCharacterTexture binds skin/cape ids to a character.
func (c *Client) SetCharacterTexture(ctx context.Context, opts SetCharacterTextureOptions, token string) error {
	q := url.Values{}
	if opts.Skin != nil {
		q.Set("skin", fmt.Sprintf("%v", *opts.Skin))
	}
	if opts.Cape != nil {
		q.Set("cape", fmt.Sprintf("%v", *opts.Cape))
	}
	u := fmt.Sprintf("%s/api/players/%v/textures?%s", baseURL, opts.PID, q.Encode())
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, u, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return c.discardOK(req)
}

// ListSkinResult mirrors xmcl-runtime-api ListSkinResult.
type ListSkinResult struct {
	CurrentPage  float64        `json:"current_page"`
	Data         []any          `json:"data"`
	FirstPageURL string         `json:"first_page_url"`
	From         float64        `json:"from"`
	LastPage     float64        `json:"last_page"`
	LastPageURL  string         `json:"last_page_url"`
	Links        []any          `json:"links"`
	NextPageURL  string         `json:"next_page_url"`
	Path         string         `json:"path"`
	PerPage      float64        `json:"per_page"`
	PrevPageURL  any            `json:"prev_page_url"`
	To           float64        `json:"to"`
	Total        float64        `json:"total"`
}

// ListSkins fetches the public skin library (no auth required).
func (c *Client) ListSkins(ctx context.Context) (*ListSkinResult, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/skinlib/list", nil)
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("littleskin ListSkins: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var out ListSkinResult
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return &out, nil
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
