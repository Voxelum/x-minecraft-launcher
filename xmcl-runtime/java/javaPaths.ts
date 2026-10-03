import { readdir } from 'fs-extra'
import { join, win32 } from 'path'
import { homedir } from 'os'
import { readdirIfPresent } from '../util/fs'

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

export async function getAdoptiumJavaPaths(environment = process.env) {
  const roots = new Set([
    environment.ProgramW6432 || 'C:\\Program Files',
    environment.ProgramFiles || 'C:\\Program Files',
    environment['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ].map(root => win32.join(root, 'Eclipse Adoptium')))
  const paths = await Promise.all([...roots].map(async (root) => {
    const files = await readdirIfPresent(root)
    return files.map(file => win32.join(root, file, 'bin', 'java.exe'))
  }))
  return paths.flat()
}

export async function getZuluJdkPath() {
  const files = await readdir('C:\\Program Files\\Zulu').catch(() => [])
  return files.map(f => join('C:\\Program Files\\Zulu', f, 'bin', 'java.exe'))
}

export async function getJavaPathsLinux() {
  const files = await readdir('/usr/lib/jvm').catch(() => [])
  return files.map(f => join('/usr/lib/jvm', f, 'bin', 'java'))
}

export async function getJavaPathsLinuxSDK() {
  const files = await readdir(`${homedir}/.sdkman/candidates/java`).catch(() => [])
  return files.map(f => join(`${homedir}/.sdkman/candidates/java`, f, 'bin', 'java'))
}

export async function getJavaPathsOSX() {
  const files = await readdir('/Library/Java/JavaVirtualMachines').catch(() => [])
  return files.map(f => join('/Library/Java/JavaVirtualMachines', f, 'Contents', 'Home', 'bin', 'java'))
}
