import { kAgentDocumentDirectory } from '@xmcl/runtime/agent/documents'
import type { LauncherAppPlugin } from '@xmcl/runtime/app'
import { IS_DEV } from '@xmcl/runtime/constant'
import { join, resolve } from 'path'

/**
 * Same contract as the Electron plugin, different lookup: Electron resolved the
 * directory from `process.resourcesPath`, which does not exist in a plain Node
 * process, so the Rust shell passes its resource directory instead.
 */
export function resolveAgentDocumentDirectory(
  isDev: boolean,
  resourcesPath = process.env.XMCL_RESOURCES_PATH,
) {
  if (isDev || !resourcesPath) {
    return resolve(__dirname, '..', '..', 'xmcl-electron-app', 'main', 'agent-documents')
  }
  return join(resourcesPath, 'agent-documents')
}

export const pluginAgentDocuments: LauncherAppPlugin = (app) => {
  app.registry.register(kAgentDocumentDirectory, resolveAgentDocumentDirectory(IS_DEV))
}
