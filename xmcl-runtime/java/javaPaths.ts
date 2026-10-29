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

/**
 * Whether the launcher is running inside a Flatpak sandbox.
 *
 * Flatpak sets `FLATPAK_ID` to the application id for every process in the
 * sandbox, so its presence is a reliable signal without spawning a process.
 */
export function isFlatpakSandbox(environment: NodeJS.ProcessEnv = process.env) {
  return typeof environment.FLATPAK_ID === 'string' && environment.FLATPAK_ID.length > 0
}

/**
 * Distro JDK roots of the host system, visible from a Flatpak sandbox.
 *
 * Inside Flatpak, `/usr` belongs to the Flatpak runtime (usually the
 * freedesktop one), which ships no JDK at all — so `/usr/lib/jvm` is always
 * empty there. The host filesystem is bind mounted read-only under `/run/host`
 * (`/var/run` is a symlink to `/run`), which is the only place the system
 * installed JDKs can be discovered from the sandbox. See issue #1789.
 */
const FLATPAK_HOST_JVM_ROOTS = [
  '/var/run/host/usr/lib/jvm',
  '/var/run/host/usr/lib64/jvm',
  '/var/run/host/usr/java',
]

async function listJavaInJvmRoots(roots: string[]) {
  const paths = await Promise.all(roots.map(async (root) => {
    // A missing or inaccessible root is expected: `/usr/lib/jvm` may not exist
    // on some distributions and `/var/run/host/*` is unreadable when the
    // sandbox blocks host access. Never let one root hide the others.
    const files = await readdir(root).catch(() => [] as string[])
    return files.map(f => join(root, f, 'bin', 'java'))
  }))
  return paths.flat()
}

export async function getJavaPathsLinux(environment: NodeJS.ProcessEnv = process.env) {
  const roots = ['/usr/lib/jvm']
  if (isFlatpakSandbox(environment)) {
    roots.push(...FLATPAK_HOST_JVM_ROOTS)
  }
  return listJavaInJvmRoots(roots)
}

export async function getJavaPathsLinuxSDK() {
  const files = await readdir(`${homedir}/.sdkman/candidates/java`).catch(() => [])
  return files.map(f => join(`${homedir}/.sdkman/candidates/java`, f, 'bin', 'java'))
}

export async function getJavaPathsOSX() {
  const files = await readdir('/Library/Java/JavaVirtualMachines').catch(() => [])
  return files.map(f => join('/Library/Java/JavaVirtualMachines', f, 'Contents', 'Home', 'bin', 'java'))
}
