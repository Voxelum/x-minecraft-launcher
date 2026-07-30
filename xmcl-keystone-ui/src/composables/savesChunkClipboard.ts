import { shallowRef } from 'vue'
import type { SaveChunkData } from '@xmcl/runtime-api'

// A single, module-level clipboard shared by every world-map instance. Because
// it lives at module scope (not inside a component's `setup`), chunks copied
// from one save remain available after the user navigates to another save and
// the map component is re-created.
const chunkClipboard = shallowRef<SaveChunkData[]>([])

export function useSavesChunkClipboard() {
  return chunkClipboard
}
