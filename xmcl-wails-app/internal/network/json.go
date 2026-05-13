package network

import "encoding/json"

// jsonDecode is a small wrapper to keep the encoding/json import
// confined to one file (tests may swap it out later).
func jsonDecode(data []byte, v any) error {
	return json.Unmarshal(data, v)
}
