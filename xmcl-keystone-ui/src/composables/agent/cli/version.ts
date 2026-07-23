import type { VersionMetadataService, VersionService } from '@xmcl/runtime-api'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const VERSION_USAGE = 'version list <local|minecraft|forge|neoforge|fabric|quilt|optifine|labymod> [minecraftVersion] [options]'

interface PageOptions {
  page: number
  pageSize: number
}

function paginate<T>(items: T[], { page, pageSize }: PageOptions) {
  const offset = (page - 1) * pageSize
  const versions = items.slice(offset, offset + pageSize)
  const totalPages = Math.ceil(items.length / pageSize)
  return {
    pagination: {
      page,
      pageSize,
      resultCount: versions.length,
      totalCount: items.length,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
    versions,
  }
}

export function createVersionCommand(services: {
  metadata: Pick<VersionMetadataService, 'getMinecraftVersions' | 'getForgeVersions' | 'getNeoForgedVersions' | 'getFabricVersions' | 'getQuiltVersions' | 'getOptifineVersions' | 'getLabyModManifest'>
  versions: Pick<VersionService, 'getLocalVersions'>
}): VirtualCliCommand {
  return {
    name: 'version',
    usage: VERSION_USAGE,
    description: 'List locally installed versions or remote Minecraft and mod-loader versions.',
    help: [
      '`version list local [--server] [--type <vanilla|forge|fabric|quilt|neoforge>] [--page <n>] [--page-size <1-100>]`',
      '`version list minecraft [--type <release|snapshot|old_beta|old_alpha|all>] [--page <n>] [--page-size <1-100>] [--refresh]`',
      '`version list forge <minecraftVersion> [--page <n>] [--page-size <1-100>] [--refresh]`',
      '`version list neoforge <minecraftVersion> [--page <n>] [--page-size <1-100>] [--refresh]`',
      '`version list fabric [minecraftVersion] [--stable] [--page <n>] [--page-size <1-100>] [--refresh]`',
      '`version list quilt [minecraftVersion] [--stable] [--page <n>] [--page-size <1-100>] [--refresh]`',
      '`version list optifine [minecraftVersion] [--page <n>] [--page-size <1-100>] [--refresh]`',
      '`version list labymod [minecraftVersion] [--page <n>] [--page-size <1-100>] [--refresh]`',
      'Remote metadata is cached. Use `--refresh` only when fresh provider data is required.',
      'Use returned values verbatim with `instance create` runtime options.',
    ],
    execute: async (argv) => {
      const [action, provider, ...rest] = argv
      if (action !== 'list' || !provider) return usageError(VERSION_USAGE, 'Expected `version list <provider>`.')

      const positionals: string[] = []
      let page = 1
      let pageSize = 20
      let type: string | undefined
      let stable = false
      let server = false
      let refresh = false
      for (let index = 0; index < rest.length; index++) {
        const token = rest[index]
        if (!token.startsWith('--')) {
          positionals.push(token)
        } else if (token === '--page' || token === '--page-size') {
          const value = rest[++index]
          const parsed = Number(value)
          if (!value || !Number.isSafeInteger(parsed) || parsed <= 0) return usageError(VERSION_USAGE, `${token} must be a positive integer.`)
          if (token === '--page') page = parsed
          else {
            if (parsed > 100) return usageError(VERSION_USAGE, '--page-size cannot exceed 100.')
            pageSize = parsed
          }
        } else if (token === '--type') {
          type = rest[++index]
          if (!type || type.startsWith('--')) return usageError(VERSION_USAGE, '--type requires a value.')
        } else if (token === '--stable') {
          stable = true
        } else if (token === '--server') {
          server = true
        } else if (token === '--refresh') {
          refresh = true
        } else {
          return usageError(VERSION_USAGE, `Unknown version option: ${token}`)
        }
      }
      if (positionals.length > 1) return usageError(VERSION_USAGE, 'Too many positional arguments.')
      const minecraft = positionals[0]
      const paging = { page, pageSize }

      if (provider === 'local') {
        if (minecraft || stable || refresh) return usageError(VERSION_USAGE, 'Invalid option for local versions.')
        const localTypes = ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge']
        if (type && !localTypes.includes(type)) return usageError(VERSION_USAGE, `Invalid local version type: ${type}`)
        const state = await services.versions.getLocalVersions()
        if (server) {
          const filtered = type ? state.servers.filter((version) => version.type === type) : state.servers
          return { provider, server, type: type ?? 'all', ...paginate(filtered, paging) }
        }
        const filtered = type
          ? state.local.filter((version) => type === 'vanilla'
            ? !version.forge && !version.fabric && !version.quilt && !version.neoForged
            : type === 'forge'
              ? !!version.forge
              : type === 'fabric'
                ? !!version.fabric
                : type === 'quilt'
                  ? !!version.quilt
                  : type === 'neoforge' && !!version.neoForged)
          : state.local
        return { provider, server, type: type ?? 'all', ...paginate(filtered, paging) }
      }
      if (server || (type && provider !== 'minecraft')) return usageError(VERSION_USAGE, `Invalid option for ${provider} versions.`)

      if (provider === 'minecraft') {
        if (minecraft || stable) return usageError(VERSION_USAGE, 'Minecraft listing does not accept a version or --stable.')
        const minecraftTypes = ['release', 'snapshot', 'old_beta', 'old_alpha', 'all']
        if (type && !minecraftTypes.includes(type)) return usageError(VERSION_USAGE, `Invalid Minecraft version type: ${type}`)
        const result = await services.metadata.getMinecraftVersions(refresh)
        const versions = !type || type === 'all' ? result.versions : result.versions.filter((version) => version.type === type)
        return { provider, latest: result.latest, type: type ?? 'all', ...paginate(versions, paging) }
      }
      if (provider === 'forge') {
        if (!minecraft || stable) return usageError(VERSION_USAGE, `${provider} requires one Minecraft version.`)
        const versions = await services.metadata.getForgeVersions(minecraft, refresh)
        return { provider, minecraft, ...paginate(versions, paging) }
      }
      if (provider === 'neoforge') {
        if (!minecraft || stable) return usageError(VERSION_USAGE, `${provider} requires one Minecraft version.`)
        const versions = await services.metadata.getNeoForgedVersions(minecraft, refresh)
        return { provider, minecraft, ...paginate(versions, paging) }
      }
      if (provider === 'fabric' || provider === 'quilt') {
        const result = provider === 'fabric'
          ? await services.metadata.getFabricVersions(refresh)
          : await services.metadata.getQuiltVersions(refresh)
        const versions = result.loaderVersions.filter((version) => (!minecraft || !version.gameVersion || version.gameVersion === minecraft) && (!stable || version.stable !== false))
        return { provider, minecraft: minecraft ?? 'all', gameVersions: result.gameVersions, stable, ...paginate(versions, paging) }
      }
      if (provider === 'optifine') {
        if (stable) return usageError(VERSION_USAGE, 'OptiFine listing does not support --stable.')
        const result = await services.metadata.getOptifineVersions(refresh)
        const versions = minecraft ? result.filter((version) => version.mcversion === minecraft) : result
        return { provider, minecraft: minecraft ?? 'all', ...paginate(versions, paging) }
      }
      if (provider === 'labymod') {
        if (stable) return usageError(VERSION_USAGE, 'LabyMod listing does not support --stable.')
        const manifest = await services.metadata.getLabyModManifest(refresh)
        const versions = minecraft ? manifest.minecraftVersions.filter((version) => version.version === minecraft) : manifest.minecraftVersions
        return { provider, labyModVersion: manifest.labyModVersion, ...paginate(versions, paging) }
      }
      return usageError(VERSION_USAGE, `Unknown version provider: ${provider}`)
    },
  }
}
