import { InstanceFile } from '@xmcl/instance'
import { readEntry } from '@xmcl/unzip'
import { Entry, ZipFile as YauzlZipFile } from '@xmcl/yauzl'
import { basename, extname } from 'path'
import { LauncherApp } from '~/app'
import { ModpackHandler } from '../ModpackService'

export interface TechnicManifest {
  name: string
  minecraft: string
  forge?: string
  fabricLoader?: string
  neoForged?: string
  icon?: string
}

export function createTechnicHandler(app: LauncherApp): ModpackHandler<TechnicManifest> {
  return {
    async resolveModpackMarketMetadata() {
      return undefined
    },

    resolveUnpackPath(manifest, entry) {
      const name = entry.fileName
      if (name.endsWith('/')) return undefined

      // Skip server-specific batch/sh runners and redundant server jars in client instance
      if (
        name.endsWith('.bat') ||
        name.endsWith('.sh') ||
        name.startsWith('bin/') ||
        name === 'server.properties' ||
        name === 'eula.txt' ||
        name === 'RestoreBackup.bat' ||
        name === 'RestoreBackup.sh'
      ) {
        return undefined
      }

      return name
    },

    async readManifest(zipFile: YauzlZipFile, entries: Entry[]): Promise<TechnicManifest | undefined> {
      const hasMods = entries.some((e) => e.fileName.startsWith('mods/') && !e.fileName.endsWith('/'))
      const hasBin = entries.some((e) => e.fileName.startsWith('bin/'))
      const hasConfig = entries.some((e) => e.fileName.startsWith('config/'))

      if (!hasMods && !hasBin && !hasConfig) {
        return undefined
      }

      let minecraft = ''
      let forge: string | undefined
      let fabricLoader: string | undefined

      // Extract clean name from zip filename: e.g. "the-1122-pack_1.6.6.zip" -> "The 1.12.2 Pack"
      const rawName = basename(zipFile.fileName || '', extname(zipFile.fileName || ''))
      let name = rawName
        ? rawName
            .replace(/[_-]1\.\d+(\.\d+)?/g, '')
            .replace(/[_-]/g, ' ')
            .replace(/1122/g, '1.12.2')
            .replace(/1710/g, '1.7.10')
            .replace(/1165/g, '1.16.5')
            .replace(/1201/g, '1.20.1')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim()
        : 'Technic Modpack'

      // 1. Check version.json or bin/version.json
      const versionEntry = entries.find((e) => e.fileName === 'bin/version.json' || e.fileName === 'version.json')
      if (versionEntry) {
        try {
          const buf = await readEntry(zipFile, versionEntry)
          const json = JSON.parse(buf.toString())
          if (json.inheritsFrom) {
            minecraft = json.inheritsFrom
          }
          if (json.id) {
            const forgeMatch = json.id.match(/([0-9\.]+)-forge-?([0-9\.]*)/i) || json.id.match(/([0-9\.]+)-forge/i)
            if (forgeMatch) {
              minecraft = forgeMatch[1]
              if (forgeMatch[2]) forge = forgeMatch[2]
            }
          }
        } catch { }
      }

      // 2. Check forge / minecraft server jar files in root or bin
      if (!minecraft || !forge) {
        const forgeJar = entries.find((e) => /forge-(1\.\d+(?:\.\d+)?)-([0-9\.]+)/i.test(e.fileName) || /forge/i.test(e.fileName))
        if (forgeJar) {
          const match = forgeJar.fileName.match(/forge-(1\.\d+(?:\.\d+)?)-([0-9\.]+?)(?:-universal)?\.jar/i)
            || forgeJar.fileName.match(/forge-(1\.\d+(?:\.\d+)?)-([0-9\.]+)/i)
          if (match) {
            if (!minecraft) minecraft = match[1]
            forge = match[2]
          }
        }
      }

      if (!minecraft) {
        const serverJar = entries.find((e) => /minecraft_server\.(1\.\d+(?:\.\d+)?)\.jar/i.test(e.fileName))
        if (serverJar) {
          const match = serverJar.fileName.match(/minecraft_server\.(1\.\d+(?:\.\d+)?)\.jar/i)
          if (match) {
            minecraft = match[1]
          }
        }
      }

      // 3. Fallback: inspect mod filenames in mods/ to detect game version
      if (!minecraft) {
        for (const e of entries) {
          const mcMatch = e.fileName.match(/-(1\.\d+(?:\.\d+)?)-/i) || e.fileName.match(/\[(1\.\d+(?:\.\d+)?)\]/i) || e.fileName.match(/-(1\.\d+(?:\.\d+)?)\.jar/i)
          if (mcMatch) {
            minecraft = mcMatch[1]
            break
          }
        }
      }

      // Default fallback
      if (!minecraft) {
        minecraft = '1.12.2'
      }

      // Default Forge if Forge modpack without specific version
      if (!forge && !fabricLoader) {
        if (minecraft === '1.12.2') forge = '14.23.5.2860'
        else if (minecraft === '1.7.10') forge = '10.13.4.1614'
        else if (minecraft === '1.16.5') forge = '36.2.39'
        else if (minecraft === '1.20.1') forge = '47.3.0'
      }

      return {
        name,
        minecraft,
        forge,
        fabricLoader,
      }
    },

    resolveInstanceOptions(manifest: TechnicManifest) {
      return {
        name: manifest.name,
        runtime: {
          minecraft: manifest.minecraft,
          forge: manifest.forge,
          fabricLoader: manifest.fabricLoader,
          neoForged: manifest.neoForged,
        },
      }
    },

    async resolveInstanceFiles(): Promise<InstanceFile[]> {
      return []
    },
  }
}
