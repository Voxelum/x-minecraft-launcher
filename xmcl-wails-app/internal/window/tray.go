// tray.go — system tray icon + context menu, mirroring
// `xmcl-electron-app/main/controllers/tray.ts`. Single-click on
// Windows toggles the main window; right-click opens the menu.
//
// Menu items (kept in sync with the legacy build):
//   - Show launcher
//   - Multiplayer (deferred — opens the multiplayer window)
//   - Make desktop shortcut (deferred — needs system service port)
//   - Show diagnosis (devtools toggle)
//   - Relaunch
//   - Quit

package window

import (
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/voxelum/xmcl/wails/internal/host"
)

// InstallTray creates and shows the launcher's tray icon. Returns
// the tray handle so the caller can keep it alive (it's also stored
// inside the Wails App).
func InstallTray(app *application.App, h *host.Host, mainWindow *application.WebviewWindow) *application.SystemTray {
	tray := app.SystemTray.New()
	tray.SetIcon(TrayIconLight)
	tray.SetDarkModeIcon(TrayIconDark)
	tray.SetTooltip("X Minecraft Launcher")

	showWindow := func() {
		if mainWindow == nil {
			return
		}
		if mainWindow.IsMinimised() {
			mainWindow.UnMinimise()
		}
		mainWindow.Show()
		mainWindow.Focus()
	}

	menu := application.NewMenu()
	menu.Add("Show launcher").OnClick(func(_ *application.Context) { showWindow() })
	menu.AddSeparator()
	menu.Add("Show diagnosis").OnClick(func(_ *application.Context) {
		if mainWindow != nil {
			mainWindow.OpenDevTools()
		}
	})
	menu.Add("Relaunch").OnClick(func(_ *application.Context) {
		// Wails v3 has no built-in relaunch; the cleanest approach
		// is to quit and let the user restart manually. We keep the
		// menu item so users see parity with the Electron UI; a
		// future phase will spawn a detached child process.
		app.Quit()
	})
	menu.Add("Quit").OnClick(func(_ *application.Context) {
		app.Quit()
	})
	tray.SetMenu(menu)

	// Single-click toggles on Windows; the legacy build wires
	// double-click for the same purpose, but Wails v3 fires both
	// click + double-click for trays so single-click is enough.
	if runtime.GOOS == "windows" {
		tray.OnClick(func() { showWindow() })
		tray.OnDoubleClick(func() { showWindow() })
	} else {
		// macOS / Linux conventionally use the menu only.
		tray.OnDoubleClick(func() { showWindow() })
	}

	if h != nil && h.Logger != nil {
		h.Logger.Info("window: system tray installed")
	}
	return tray
}
