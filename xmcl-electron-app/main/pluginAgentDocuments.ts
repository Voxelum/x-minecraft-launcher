import { kAgentDocumentDirectory } from '@xmcl/runtime/agent/documents'
import { IS_DEV } from '@xmcl/runtime/constant'
import { join } from 'path'
import type { LauncherAppPlugin } from '~/app'

export function resolveAgentDocumentDirectory(isDev: boolean, resourcesPath = process.resourcesPath) {
  return isDev
    ? join(__dirname, '..', 'main', 'agent-documents')
    : join(resourcesPath, 'agent-documents')
}

export const pluginAgentDocuments: LauncherAppPlugin = (app) => {
  app.registry.register(kAgentDocumentDirectory, resolveAgentDocumentDirectory(IS_DEV))
}