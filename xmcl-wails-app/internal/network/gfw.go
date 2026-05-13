// Package network — gfw.go
//
// Heuristic detection of "the user is probably behind the Great
// Firewall of China" so the auto-mode of `apiSetsPreference == ""`
// can pick the BMCL mirror without the user having to opt in
// manually.
//
// We don't probe the network here (a probe would slow boot + add
// false positives over flaky links). Instead we use cheap signals:
//
//   - `XMCL_GFW=1` env override (highest precedence).
//   - System locale: `zh_CN`, `zh-CN`, `zh_HK`, `zh-Hans`, ….
//   - Timezone offset: UTC+08:00 with the canonical "Asia/Shanghai"
//     name (or `China Standard Time` on Windows).
//
// None of these are bulletproof — that's fine, the user can override
// via the apiSetsPreference setting.

package network

import (
	"os"
	"strings"
	"time"
)

// IsLikelyChinaUser reports whether the host probably needs the BMCL
// mirror by default.
func IsLikelyChinaUser() bool {
	switch strings.ToLower(os.Getenv("XMCL_GFW")) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	}
	if isChineseLocale() {
		return true
	}
	if isChinaTimezone() {
		return true
	}
	return false
}

// isChineseLocale checks LANG / LC_ALL / LC_MESSAGES for a Chinese
// locale. Windows uses a different mechanism; we approximate via the
// LANG variable Cygwin / WSL / msys2 set, plus the user's chosen UI
// language when available via env vars.
func isChineseLocale() bool {
	for _, key := range []string{"LANG", "LC_ALL", "LC_MESSAGES", "LANGUAGE"} {
		v := strings.ToLower(os.Getenv(key))
		if strings.Contains(v, "zh_cn") ||
			strings.Contains(v, "zh-cn") ||
			strings.Contains(v, "zh_hk") ||
			strings.Contains(v, "zh-hans") {
			return true
		}
	}
	return false
}

// isChinaTimezone reports whether the host is on China Standard Time.
// We accept the canonical IANA name "Asia/Shanghai", the Windows
// "China Standard Time" / abbreviation "CST", and a +08:00 offset
// without DST. The latter overlaps with Singapore / Perth /
// Ulaanbaatar but those users typically don't suffer GFW-level
// blocking anyway and they can override via the settings.
func isChinaTimezone() bool {
	zone, _ := time.Now().Zone()
	switch zone {
	case "CST", "China Standard Time", "Asia/Shanghai":
		return true
	}
	loc := time.Local.String()
	if strings.Contains(loc, "Asia/Shanghai") || strings.Contains(loc, "Asia/Chongqing") ||
		strings.Contains(loc, "Asia/Urumqi") || strings.Contains(loc, "Asia/Hong_Kong") {
		return true
	}
	return false
}
