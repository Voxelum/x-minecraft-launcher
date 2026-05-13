// Package window owns the launcher's main-window lifecycle: it
// opens the WebView with the right defaults, persists size /
// position / maximised state across launches, and installs the
// system-tray icon with a context menu mirroring the legacy
// Electron build (`xmcl-electron-app/main/controllers/tray.ts`).
//
// Window sizing defaults (parity with the Electron build's
// `defaultApp.ts`):
//
//   - MinWidth   800
//   - MinHeight  400
//   - DefaultW   800
//   - DefaultH   600
//
// Persistence lives at `<appDataPath>/main-window-config.json`
// and stores `{width, height, x, y, maximized}` written through a
// 1s debounce on `WindowDidResize` / `WindowDidMove` /
// `WindowMaximise` / `WindowMinimise`. On read, an off-screen
// position resets to OS-centred placement.
package window

import (
	_ "embed"
)

//go:embed icons/dark-tray.png
var TrayIconDark []byte

//go:embed icons/light-tray.png
var TrayIconLight []byte

//go:embed icons/dark-icon.png
var WindowIconDark []byte

//go:embed icons/light-icon.png
var WindowIconLight []byte

//go:embed icons/dark.ico
var WindowIcoDark []byte

//go:embed icons/light.ico
var WindowIcoLight []byte
