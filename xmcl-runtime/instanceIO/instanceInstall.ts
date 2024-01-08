import { InstanceFile } from '@xmcl/runtime-api'
import { writeFile } from 'atomically'
import { unlink } from 'fs-extra'
import { join } from 'path'

export type RequiredPick<T, K extends keyof T> = T & Required<Pick<T, K>>

export async function writeInstallProfile(path: string, files: InstanceFile[]) {
  const filePath = join(path, '.install-profile')
  const content = {
    lockVersion: 0,
    files,
  }
  await writeFile(filePath, JSON.stringify(content, null, 4))
}

export async function removeInstallProfile(path: string) {
  const filePath = join(path, '.install-profile')
  await unlink(filePath)
}
