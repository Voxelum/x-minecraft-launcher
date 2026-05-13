package main

import (
	"embed"
	"io/fs"
	"log"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/voxelum/xmcl/wails/internal/bridge"
	"github.com/voxelum/xmcl/wails/internal/contract"
	"github.com/voxelum/xmcl/wails/internal/host"
	"github.com/voxelum/xmcl/wails/internal/mediaserver"
	"github.com/voxelum/xmcl/wails/internal/services"
	"github.com/voxelum/xmcl/wails/internal/window"
)

//go:embed all:frontend
var embeddedAssets embed.FS

func main() {
	h := host.New()

	b := bridge.New(h)

	// Install "not implemented" adapters for every service first so the
	// renderer never sees an "unknown service" error. RegisterAll then
	// overwrites each entry with the real (or skeleton) implementation
	// from internal/services/<pkg>/.
	contract.RegisterStubs(b)
	services.RegisterAll(b, h)

	// Asset source priority (Wails handles `FRONTEND_DEVSERVER_URL`
	// automatically when present — see assetserver/build_dev.go in
	// the Wails sources for the reverse-proxy details):
	//
	//   1. `FRONTEND_DEVSERVER_URL=http://localhost:5173` — Vite dev
	//      server with HMR. Wails reverse-proxies all asset requests
	//      and intercepts `/wails/*` for the bridge/runtime.
	//   2. `XMCL_RENDERER_DIR=../xmcl-keystone-ui/dist` — built
	//      keystone-ui served via the embedded asset file server.
	//   3. Embedded smoke page (G0/G1 fallback).
	assets, entry := chooseAssets()

	app := application.New(application.Options{
		Name:        "X Minecraft Launcher (Wails)",
		Description: "Go/Wails backend for XMCL",
		Services: []application.Service{
			application.NewService(b),
		},
		Assets: application.AssetOptions{
			Handler:    application.AssetFileServerFS(assets),
			Middleware: mediaserver.New(h),
		},
	})

	b.AttachApp(app)

	// Restore window geometry persisted on the previous run
	// (mirrors the Electron build's `windowSizeTracker.ts`).
	tracker := window.NewTracker(h)
	cfg := tracker.Load()

	winOpts := application.WebviewWindowOptions{
		Name:      "main",
		Title:     "XMCL",
		Width:     cfg.EffectiveWidth(),
		Height:    cfg.EffectiveHeight(),
		MinWidth:  window.MinWidth,
		MinHeight: window.MinHeight,
		URL:       entry,
		// The keystone-ui renderer paints its own titlebar
		// (`AppSystemBar.vue`) with min / max / close buttons and a
		// `-webkit-app-region: drag` move-region. Run frameless so
		// the OS chrome doesn't double up.
		Frameless: true,
	}
	if cfg.HasPosition() {
		winOpts.InitialPosition = application.WindowXY
		winOpts.X = *cfg.X
		winOpts.Y = *cfg.Y
	} else {
		winOpts.InitialPosition = application.WindowCentered
	}

	mainWin := app.Window.NewWithOptions(winOpts)
	tracker.Track(mainWin)
	window.InstallTray(app, h, mainWin)

	// Best-effort cleanup on shutdown — close SQLite handles, flush
	// pending settings writes, etc.
	app.OnShutdown(func() {
		if err := h.Close(); err != nil {
			h.Logger.Warn("host close failed", "err", err)
		}
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

// chooseAssets returns the asset filesystem to serve and the initial URL
// to load.
//
// When `FRONTEND_DEVSERVER_URL` is set, Wails' bundled asset server
// reverse-proxies every request to that URL — we still hand it an
// fs.FS, but it's never actually read.
func chooseAssets() (fs.FS, string) {
	if dir := os.Getenv("XMCL_RENDERER_DIR"); dir != "" {
		stat, err := os.Stat(dir)
		if err != nil || !stat.IsDir() {
			log.Fatalf("XMCL_RENDERER_DIR %q is not a directory: %v", dir, err)
		}
		return os.DirFS(dir), "/"
	}
	return embeddedAssets, "/"
}
