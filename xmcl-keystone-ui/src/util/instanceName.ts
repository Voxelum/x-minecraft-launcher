import { RuntimeVersions } from '@xmcl/instance'

export function generateBaseName(runtime: RuntimeVersions) {
  let name = runtime.minecraft
  if (runtime.forge) {
    name += `-forge${runtime.forge}`
  } else if (runtime.fabricLoader) {
    name += `-fabric${runtime.fabricLoader}`
  } else if (runtime.quiltLoader) {
    name += `-quilt${runtime.quiltLoader}`
  } else if (runtime.neoForged) {
    name += `-neoforge${runtime.neoForged}`
  } else if (runtime.labyMod) {
    name += `-labyMod${runtime.labyMod}`
  }
  if (runtime.optifine) {
    name += `-optifine${runtime.optifine}`
  }
  return name
}

export function generateDistinctName(baseName: string, names: string[]) {
  let name = baseName
  let idx = 1
  while (names.includes(name)) {
    name = `${name}-${idx++}`
  }
  return name
}

/**
 * Characters that are invalid in Windows file/directory names.
 * Also includes path separators which are dangerous on all platforms.
 */
const INVALID_CHARS_PATTERN = /[<>:"/\\|?*]/

/**
 * Windows reserved device names that cannot be used as directory names.
 */
const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i

/**
 * Path traversal patterns: ".." as a standalone segment
 */
const PATH_TRAVERSAL_PATTERN = /(^|[\\/])\.\.($|[\\/])/

/**
 * Names that consist of only whitespace or dots are invalid on Windows.
 */
const WHITESPACE_OR_DOTS_ONLY = /^[\s.]+$/

/**
 * Validate an instance name for filesystem safety.
 * Returns `true` if the name is valid, or a string error key if invalid.
 */
export function validateInstanceName(name: string): true | 'empty' | 'invalidChars' | 'reservedName' | 'pathTraversal' | 'whitespaceOnly' | 'trailingDotOrSpace' {
  if (!name) {
    return 'whitespaceOnly'
  }
  if (PATH_TRAVERSAL_PATTERN.test(name)) {
    return 'pathTraversal'
  }
  if (WHITESPACE_OR_DOTS_ONLY.test(name)) {
    return 'whitespaceOnly'
  }
  if (INVALID_CHARS_PATTERN.test(name)) {
    return 'invalidChars'
  }
  if (WINDOWS_RESERVED_NAMES.test(name)) {
    return 'reservedName'
  }
  if (/[. ]$/.test(name)) {
    return 'trailingDotOrSpace'
  }
  return true
}
