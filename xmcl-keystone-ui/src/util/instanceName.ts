import { RuntimeVersions } from '@xmcl/instance'

export function generateBaseName(runtime: RuntimeVersions, version?: string, icon?: string) {
  // Check if there's any matching custom loader from icon, version, runtime, or localStorage
  let customLoader: { name: string; id: string } | undefined
  try {
    const raw = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('xmcl_user_custom_modloaders') || localStorage.getItem('modloaders_custom_v1'))
      : null
    if (raw) {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        const builtins = ['fabric', 'forge', 'neoforge', 'quilt', 'optifine', 'labymod']
        if (icon) {
          const match = list.find((c: any) => c.id && !builtins.includes(c.id) && c.icon && c.icon === icon)
          if (match) customLoader = match
        }
        if (!customLoader && version) {
          const match = list.find((c: any) =>
            c.id && !builtins.includes(c.id) &&
            (!c.gameVersions || c.gameVersions.length === 0 || !runtime.minecraft || c.gameVersions.includes(runtime.minecraft)) &&
            (c.versions?.some((v: any) => v.version === version) ||
            version.toLowerCase().includes(c.id.toLowerCase()))
          )
          if (match) customLoader = match
        }
        if (!customLoader && runtime.fabricLoader) {
          const match = list.find((c: any) =>
            c.id && !builtins.includes(c.id) &&
            c.projectType !== 'mod' &&
            !c.id.toLowerCase().includes('connector') &&
            (!c.gameVersions || c.gameVersions.length === 0 || !runtime.minecraft || c.gameVersions.includes(runtime.minecraft)) &&
            c.versions?.some((v: any) => v.version === runtime.fabricLoader)
          )
          if (match) customLoader = match
        }
        if (!customLoader && runtime.neoForged) {
          const match = list.find((c: any) =>
            c.id && !builtins.includes(c.id) &&
            c.projectType !== 'mod' &&
            !c.id.toLowerCase().includes('connector') &&
            (!c.gameVersions || c.gameVersions.length === 0 || !runtime.minecraft || c.gameVersions.includes(runtime.minecraft)) &&
            c.versions?.some((v: any) => v.version === runtime.neoForged)
          )
          if (match) customLoader = match
        }
        if (!customLoader && runtime.forge) {
          const match = list.find((c: any) =>
            c.id && !builtins.includes(c.id) &&
            c.projectType !== 'mod' &&
            !c.id.toLowerCase().includes('connector') &&
            (!c.gameVersions || c.gameVersions.length === 0 || !runtime.minecraft || c.gameVersions.includes(runtime.minecraft)) &&
            c.versions?.some((v: any) => v.version === runtime.forge)
          )
          if (match) customLoader = match
        }
      }
    }
  } catch {}

  if (!customLoader && runtime.fabricLoader) {
    if (runtime.minecraft === 'b1.7.3' || runtime.minecraft === 'b1.7.2') {
      customLoader = { name: 'Babric', id: 'babric' }
    } else {
      const legacyGames = [
        '1.13.2', '1.13.1', '1.13',
        '1.12.2', '1.12.1', '1.12',
        '1.11.2', '1.11.1', '1.11',
        '1.10.2', '1.10.1', '1.10',
        '1.9.4', '1.9.3', '1.9.2', '1.9.1', '1.9',
        '1.8.9', '1.8.8', '1.8',
        '1.7.10', '1.7.9', '1.7.2',
        '1.6.4', '1.5.2', '1.4.7', '1.3.2',
      ]
      const ornitheGames = [
        '1.2.5', '1.1', '1.0.0',
        'b1.8.1', 'b1.6.6', 'b1.5_01', 'b1.4_01', 'b1.3_01', 'b1.2_02', 'b1.1_02',
        'a1.2.6', 'a1.1.2_01', 'a1.0.17_04',
        'c0.30_01c', 'c0.0.13a_03', 'rd-132211',
      ]
      if (legacyGames.includes(runtime.minecraft)) {
        customLoader = { name: 'Legacy Fabric', id: 'legacy-fabric' }
      } else if (ornitheGames.includes(runtime.minecraft)) {
        customLoader = { name: 'Ornithe', id: 'ornithe' }
      }
    }
  }

  if (customLoader) {
    const loaderTitle = (customLoader.name || customLoader.id).replace(/\s+/g, '-')
    const ver = version || runtime.fabricLoader || runtime.neoForged || runtime.forge || ''
    const cleanVer = ver ? ver.replace(/\+.*$/, '').replace(/[<>:"/\\|?*]/g, '_') : ''
    const mc = runtime.minecraft ? `${runtime.minecraft}-` : ''
    return cleanVer ? `${mc}${loaderTitle}-${cleanVer}` : `${mc}${loaderTitle}`
  }

  if (version) {
    const cleanVer = version.replace(/\+.*$/, '').replace(/[<>:"/\\|?*]/g, '_')
    if (runtime.minecraft && !cleanVer.includes(runtime.minecraft)) {
      return `${runtime.minecraft}-${cleanVer}`
    }
    return cleanVer
  }

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

export function getEffectiveInstanceName(name: string, placeholder: string) {
  return name.trim() || placeholder
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
