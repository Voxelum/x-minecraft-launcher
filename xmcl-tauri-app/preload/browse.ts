/**
 * Bridge injected into the app browser window (`browser.html`).
 *
 * It is the Tauri counterpart of `xmcl-electron-app/preload/browse.ts`: the
 * same globals as the launcher windows plus `appsHost`, which only that window
 * consumes (`xmcl-keystone-ui/src/windows/browser/Browse.vue`).
 */

import './shim/webkit'
import '../../xmcl-electron-app/preload/browse'
