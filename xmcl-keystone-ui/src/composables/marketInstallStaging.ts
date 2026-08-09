import type { InstanceFile } from '@xmcl/instance'
import { InstanceInstallServiceKey } from '@xmcl/runtime-api'
import { useDialog } from './dialog'
import { InstanceInstallDialog } from './instanceUpdate'
import { useService } from './service'

export function useMarketInstallStaging() {
  const { stageInstanceFiles } = useService(InstanceInstallServiceKey)
  const { show } = useDialog(InstanceInstallDialog)

  return async (instancePath: string, oldFiles: InstanceFile[], files: InstanceFile[]) => {
    const id = crypto.getRandomValues(new Uint8Array(8)).join('')
    const manifest = await stageInstanceFiles({ path: instancePath, oldFiles, files, id })
    show({ type: 'updates', oldFiles: manifest.oldFiles, files: manifest.files, id })
    return files.map(file => file.path)
  }
}