/**
 * Single-statement entry that installs the Wails-backed serviceChannels
 * global. Imported for its side effect by every window entry (e.g.
 * `windows/main/index.ts`) before any other module that touches
 * `serviceChannels`.
 */

import { installWailsServiceChannels } from './serviceChannels'
import { installMediaUrlShim } from './installMediaUrlShim'

// Activate only when running under Wails (the Electron preload sets
// `serviceChannels` synchronously, so its presence is the discriminator).
if (typeof globalThis !== 'undefined' && !(globalThis as any).serviceChannels) {
  installWailsServiceChannels()
  installMediaUrlShim()
}
