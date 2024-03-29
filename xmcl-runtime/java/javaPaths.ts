import { readdir } from 'fs-extra'
import { join } from 'path'

export async function getMojangJavaPaths() {
  const runtimeDir = 'C:\\Program Files (x86)\\Minecraft Launcher\\runtime'
  const runtimes = await readdir(runtimeDir).catch(() => [])
  const arch = process.arch === 'ia32' ? 'x86' : 'x64'
  const platformArch = `windows-${arch}`
  return runtimes.map((runtime) => join(runtimeDir, runtime, platformArch, runtime, 'bin', 'java.exe'))
    .flat()
}

export async function getOrcaleJavaPaths() {
  const files = await readdir('C:\\Program Files\\Java').catch(() => [])
  return files.map(f => join('C:\\Program Files\\Java', f, 'bin', 'java.exe'))
}

export async function getOpenJdkPaths() {
  const files = await readdir('C:\\Program Files\\AdoptOpenJDK').catch(() => [])
  return files.map(f => join('C:\\Program Files\\AdoptOpenJDK', f, 'bin', 'java.exe'))
}

export async function getJavaPathsLinux() {
  const files = await readdir('/usr/lib/jvm').catch(() => [])
  return files.map(f => join('/usr/lib/jvm', f, 'bin', 'java'))
}

export async function getJavaPathsOSX() {
  const files = await readdir('/Library/Java/JavaVirtualMachines').catch(() => [])
  return files.map(f => join('/Library/Java/JavaVirtualMachines', f, 'Contents', 'Home', 'bin', 'java'))
}
