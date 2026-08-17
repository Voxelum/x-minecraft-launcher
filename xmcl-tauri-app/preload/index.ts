/**
 * Renderer bridge injected by the shell before any page script.
 *
 * It is the Tauri counterpart of `xmcl-electron-app/preload/index.ts` and
 * reuses those very modules: `esbuild.config.ts` aliases `electron` to
 * `shim/electron.ts`, so the globals (`serviceChannels`, `windowController`,
 * `taskMonitor`, `bootstrap`) keep the exact shape `xmcl-keystone-ui` expects.
 */

import './shim/webkit'
import '../../xmcl-electron-app/preload/controller'
import '../../xmcl-electron-app/preload/service'
import '../../xmcl-electron-app/preload/task'
import '../../xmcl-electron-app/preload/bootstrap'
