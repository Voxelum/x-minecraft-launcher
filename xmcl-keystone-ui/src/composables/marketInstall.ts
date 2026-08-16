import type { InstanceFile } from '@xmcl/instance'
import { type InstanceInstallService, InstanceInstallServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'

type InstallInstanceFiles = InstanceInstallService['installInstanceFiles']

export async function installMarketFiles(
  installInstanceFiles: InstallInstanceFiles,
  instancePath: string,
  oldFiles: InstanceFile[],
  files: InstanceFile[],
) {
  await installInstanceFiles({ path: instancePath, oldFiles, files })
  return files.map(file => file.path)
}

export function useMarketInstall() {
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  return (instancePath: string, oldFiles: InstanceFile[], files: InstanceFile[]) =>
    installMarketFiles(installInstanceFiles, instancePath, oldFiles, files)
}