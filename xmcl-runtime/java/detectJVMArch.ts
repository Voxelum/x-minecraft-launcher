import { join } from 'path'
import { LauncherApp } from '~/app'
import { exec } from 'child_process'
import { existsSync, writeFile } from 'fs-extra'
// @ts-ignore
import javaProxy from './JavaProxy.class'

export async function ensureClass(app: LauncherApp) {
  const dest = join(app.appDataPath, 'JavaProxy.class')
  await writeFile(dest, javaProxy)
}

export async function getJavaArch(app: LauncherApp, javaPath: string) {
  const dest = join(app.appDataPath, 'JavaProxy.class')
  if (!existsSync(dest)) {
    await writeFile(dest, javaProxy)
  }
  const stdout = await new Promise<string>((resolve, reject) => {
    exec(`"${javaPath}" JavaProxy -jvm_info`, { cwd: app.appDataPath }, (err, stdout, stderr) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
  try {
    const content = JSON.parse(stdout)
    const arch = content.java_arch as string
    if (arch === '32') return 'x86'
    if (arch === '64') return 'x64'
    return arch
  } catch {
    return undefined
  }
}
