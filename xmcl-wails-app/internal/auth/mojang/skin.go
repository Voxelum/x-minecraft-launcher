// Skin upload endpoints for the Microsoft-account / Minecraft-services
// REST API. The vanilla launcher has two upstream paths:
//
//   - POST /minecraft/profile/skins  with Content-Type:application/json
//     and body `{"url": "<https-url>", "variant": "slim|classic"}` —
//     Mojang fetches the image server-side. Used when the renderer
//     hands us an https:// URL for the skin.
//   - POST /minecraft/profile/skins  with Content-Type:multipart/form-data
//     `variant=…&file=<image bytes>` — used for local-file uploads.
//   - DELETE /minecraft/profile/skins/active — resets the player to
//     the default Steve / Alex skin.
//
// All three return the updated player profile JSON.
//
// Mirrors `packages/user/mojang.ts` (`setSkin`, `resetSkin`).

package mojang

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
)

// SkinVariant is the Mojang variant flag — "slim" (Alex) or "classic"
// (Steve).
type SkinVariant string

const (
	SkinVariantSlim    SkinVariant = "slim"
	SkinVariantClassic SkinVariant = "classic"
)

// SkinResponse is the subset of the profile JSON the renderer uses
// after a successful skin update.
type SkinResponse struct {
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
}

// SetSkinByURL points Mojang at an https URL; their CDN downloads the
// image and applies it. Returns the updated profile.
func (c *Client) SetSkinByURL(ctx context.Context, skinURL string, variant SkinVariant, token string) (*SkinResponse, error) {
	body, _ := json.Marshal(map[string]string{
		"url":     skinURL,
		"variant": string(variant),
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.minecraftservices.com/minecraft/profile/skins",
		bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return c.skinResponse(req)
}

// SetSkinByFile uploads raw PNG bytes via multipart/form-data.
// `fileName` should typically be the player's name + `.png`.
func (c *Client) SetSkinByFile(ctx context.Context, fileName string, png []byte, variant SkinVariant, token string) (*SkinResponse, error) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if err := mw.WriteField("variant", string(variant)); err != nil {
		return nil, err
	}
	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename=%q`, sanitiseFileName(fileName)))
	hdr.Set("Content-Type", "image/png")
	part, err := mw.CreatePart(hdr)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(png); err != nil {
		return nil, err
	}
	if err := mw.Close(); err != nil {
		return nil, err
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.minecraftservices.com/minecraft/profile/skins",
		&buf)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return c.skinResponse(req)
}

// ResetSkin removes the active skin so the player reverts to the
// default Steve / Alex.
func (c *Client) ResetSkin(ctx context.Context, token string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete,
		"https://api.minecraftservices.com/minecraft/profile/skins/active", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 == 2 {
		return nil
	}
	return fmt.Errorf("resetSkin: HTTP %d: %s", resp.StatusCode, string(body))
}

func (c *Client) skinResponse(req *http.Request) (*SkinResponse, error) {
	resp, err := c.http().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("setSkin: HTTP %d: %s", resp.StatusCode, string(body))
	}
	var out SkinResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("setSkin: decode: %w", err)
	}
	return &out, nil
}

// sanitiseFileName collapses dangerous chars so the multipart filename
// header stays well-formed even for unusual usernames.
func sanitiseFileName(name string) string {
	r := strings.NewReplacer(`"`, "_", `\`, "_", "/", "_", "\n", "_", "\r", "_")
	cleaned := r.Replace(name)
	if cleaned == "" {
		return "skin.png"
	}
	return cleaned
}
