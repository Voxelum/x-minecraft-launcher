import { exec } from 'child_process'
import { stat } from 'fs/promises'
import { EOL, platform } from 'os'
import { join } from 'path'
import { missing } from './utils'

export interface JavaInfo {
  /**
   * Full java executable path
   */
  path: string
  /**
   * Java version string
   */
  version: string
  /**
   * Major version of java
   */
  majorVersion: number
}

/**
 * Try to resolve a java info at this path. This will call `java -version`
 * @param path The java exectuable path.
 */
export async function resolveJava(path: string): Promise<JavaInfo | undefined> {
  if (await missing(path)) {
    return undefined
  }

  return new Promise((resolve) => {
    exec(`"${path}" -version`, (_err, _sout, serr) => {
      if (serr) {
        const ver = parseJavaVersion(serr)
        if (ver) {
          resolve({ path, ...ver })
        } else {
          resolve(undefined)
        }
      } else {
        resolve(undefined)
      }
    })
  })
}

export class ParseJavaVersionError extends Error {
  name = 'ParseJavaVersionError'

  constructor(message: string) {
    super(message)
  }
}

/**
 * Parse version string and major version number from stderr of java process.
 *
 * @param versionText The stderr for `java -version`
 */
export function parseJavaVersion(
  versionText: string,
): { version: string; majorVersion: number; patch: number } | undefined {
  const getVersion = (str?: string) => {
    if (!str) {
      return undefined
    }
    const match = /(\d+)\.(\d)+\.(\d+)(_\d+)?/.exec(str)
    if (match === null) {
      const openjdkMatch = /openjdk version "(\d+)"/.exec(str)
      if (openjdkMatch) {
        return {
          version: openjdkMatch[1],
          majorVersion: Number.parseInt(openjdkMatch[1]),
          patch: -1,
        }
      }
      return undefined
    }
    if (match[1] === '1') {
      return {
        version: match[0],
        majorVersion: Number.parseInt(match[2]),
        patch: Number.parseInt(match[4]?.substring(1) ?? '-1'),
      }
    }
    return {
      version: match[0],
      majorVersion: Number.parseInt(match[1]),
      patch: Number.parseInt(match[3]),
    }
  }
  try {
    const javaVersion = getVersion(versionText)
    if (!javaVersion) {
      return undefined
    }
    return javaVersion
  } catch (e) {
    throw new ParseJavaVersionError(
      `Fail to parse java version [${versionText}]: ${(e as any).message}`,
    )
  }
}

/**
 * Get all potential java locations for Minecraft.
 *
 * On mac/linux, it will perform `which java`. On win32, it will perform `where java`
 *
 * @returns The absolute java locations path
 */
export async function getPotentialJavaLocations(): Promise<string[]> {
  const unchecked = new Set<string>()
  const currentPlatform = platform()
  const javaFile = currentPlatform === 'win32' ? 'java.exe' : 'java'

  if (process.env.JAVA_HOME) {
    unchecked.add(join(process.env.JAVA_HOME, 'bin', javaFile))
  }

  const which = () =>
    new Promise<string>((resolve) => {
      exec('which java', (_error, stdout) => {
        if (!_error) resolve(stdout.replace('\n', ''))
        else resolve('')
      }).once('error', () => resolve(''))
    })
  const where = () =>
    new Promise<string[]>((resolve) => {
      exec('where java', (_error, stdout) => {
        if (!_error) resolve(stdout.split('\r\n'))
        else resolve([])
      }).once('error', () => resolve([]))
    })

  if (currentPlatform === 'win32') {
    const out = await new Promise<string[]>((resolve) => {
      exec(
        'REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome',
        (_error, stdout) => {
          if (!stdout) {
            resolve([])
          }
          resolve(
            stdout
              .split(EOL)
              .map((item) => item.replace(/[\r\n]/g, ''))
              .filter((item) => item !== null && item !== undefined)
              .filter((item) => item[0] === ' ')
              .map((item) => `${item.split('    ')[3]}\\bin\\java.exe`),
          )
        },
      )
    })
    for (const o of [...out, ...(await where())]) {
      unchecked.add(o)
    }
  } else if (currentPlatform === 'darwin') {
    unchecked.add('/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java')
    unchecked.add(await which())
  } else {
    unchecked.add(await which())
  }

  const checkingList = Array.from(unchecked)
    .filter((jPath) => typeof jPath === 'string')
    .filter((p) => p !== '')

  return checkingList
}

async function dedupJreExecutables(files: Iterable<string>) {
  // some file might shared same ino
  const inos = new Set<number>()
  const result: string[] = []
  for (const file of files) {
    const fstat = await stat(file).catch(() => ({ ino: -1 }))
    if (inos.has(fstat.ino)) {
      continue
    }
    inos.add(fstat.ino)
    result.push(file)
  }
  return result
}

/**
 * Scan local java version on the disk.
 *
 * It will check if the passed `locations` are the home of java.
 * Notice that the locations should not be the executable, but the path of java installation, like JAVA_HOME.
 *
 * This will call `getPotentialJavaLocations` and then `resolveJava`
 *
 * @param locations The location (like java_home) want to check.
 * @returns All validate java info
 */
export async function scanLocalJava(locations: string[]): Promise<JavaInfo[]> {
  const unchecked = new Set(locations)
  const potential = await getPotentialJavaLocations()
  potential.forEach((p) => unchecked.add(p))

  const checkingList = await dedupJreExecutables(
    [...unchecked].filter((jPath) => typeof jPath === 'string').filter((p) => p !== ''),
  )

  const javas = await Promise.all(checkingList.map((jPath) => resolveJava(jPath)))
  return javas.filter(((j) => j !== undefined) as (j?: JavaInfo) => j is JavaInfo)
}
