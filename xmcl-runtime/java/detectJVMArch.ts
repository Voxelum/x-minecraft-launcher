import { join } from 'path'
import { LauncherApp } from '~/app'
import { exec } from 'child_process'
import { existsSync, writeFile } from 'fs-extra'
// @ts-ignore
import javaProxy from './JavaProxy.class'
import { JavaService } from './JavaService'

export async function ensureClass(app: LauncherApp) {
  const dest = join(app.appDataPath, 'JavaProxy.class')
  await writeFile(dest, javaProxy)
}

export async function getJavaArch(serv: JavaService, javaPath: string) {
  const dest = join(serv.app.appDataPath, 'JavaProxy.class')
  try {
    if (!existsSync(dest)) {
      await writeFile(dest, javaProxy)
    }
    const stdout = await new Promise<string>((resolve, reject) => {
      exec(`"${javaPath}" JavaProxy -jvm_info`, { cwd: serv.app.appDataPath }, (err, stdout, stderr) => {
        if (err) reject(err)
        else resolve(stdout)
      })
    })
    const content = JSON.parse(stdout)
    const arch = content.java_arch as string
    if (arch === '32') return 'x86'
    if (arch === '64') return 'x64'
    return arch
  } catch (e) {
    // The JavaProxy invocation fails for environments whose JRE is
    // already broken (Oracle java that can't find `lib/amd64/jvm.cfg`,
    // SystemPath shim launched with the wrong working dir, etc.) and
    // also when the JRE itself throws InvocationTargetException. None
    // of these are launcher defects, so demote from `error` (→
    // trackException storm in telemetry) to `warn` and skip the JRE.
    if (e instanceof Error) {
      if (!e.stack) e.stack = new Error().stack
      serv.warn(`Failed to detect java arch for ${javaPath}: ${e.message}`)
    }
    return undefined
  }
}
