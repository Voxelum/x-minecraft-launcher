import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import type { LauncherApp } from '~/app'
import { InstallService, VersionMetadataService } from '~/install'
import { InstanceService } from '~/instance'
import type { AgentConversationKey } from '@xmcl/runtime-api'
import type { AgentCommandOperations, AgentLoader } from './commandDefinitions'

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Agent command aborted')
}

function descendingVersions(values: string[]) {
  return [...values].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
}

export async function createAgentCommandOperations(app: LauncherApp, key: AgentConversationKey): Promise<AgentCommandOperations> {
  const [modrinth, curseforge, metadata, installer, instanceService] = await Promise.all([
    app.registry.getOrCreate(ModrinthV2Client),
    app.registry.getOrCreate(CurseforgeV1Client),
    app.registry.getOrCreate(VersionMetadataService),
    app.registry.getOrCreate(InstallService),
    app.registry.getOrCreate(InstanceService),
  ])

  async function currentInstance() {
    const state = await instanceService.getSharedInstancesState()
    const instance = state.all[key.scope]
    if (!instance) throw new Error(`Current instance is unavailable: ${key.scope}`)
    return instance
  }

  async function loaderVersions(loader: AgentLoader, minecraft: string | undefined, refresh: boolean) {
    const gameVersion = minecraft ?? (await currentInstance()).runtime.minecraft
    if (!gameVersion) throw new Error('The current instance has no Minecraft version')
    if (loader === 'forge') {
      const versions = await metadata.getForgeVersions(gameVersion, refresh)
      return { minecraft: gameVersion, versions }
    }
    if (loader === 'neoforge') {
      return { minecraft: gameVersion, versions: descendingVersions(await metadata.getNeoForgedVersions(gameVersion, refresh)) }
    }
    const result = loader === 'fabric'
      ? await metadata.getFabricVersions(refresh)
      : await metadata.getQuiltVersions(refresh)
    return {
      minecraft: gameVersion,
      versions: result.loaderVersions.filter(value => !value.gameVersion || value.gameVersion === gameVersion),
    }
  }

  return {
    async searchModrinth(input, signal) {
      abortIfNeeded(signal)
      const instance = await currentInstance()
      const facets: string[][] = [[`project_type:${input.type ?? 'mod'}`]]
      const gameVersion = input.gameVersion ?? instance.runtime.minecraft
      if (gameVersion) facets.push([`versions:${gameVersion}`])
      if (input.loader) facets.push([`categories:${input.loader}`])
      const result = await modrinth.searchProjects({
        query: input.query,
        facets: JSON.stringify(facets),
        limit: input.limit,
      }, signal)
      return {
        total: result.total_hits,
        projects: result.hits.map(project => ({
          id: project.project_id,
          slug: project.slug,
          title: project.title,
          description: project.description,
          type: project.project_type,
          downloads: project.downloads,
          categories: project.categories,
          gameVersions: project.versions,
        })),
        next: 'Run `market modrinth versions <slug>` to resolve an installable version.',
      }
    },
    async getModrinthVersions(input, signal) {
      abortIfNeeded(signal)
      const instance = await currentInstance()
      const gameVersion = input.gameVersion ?? instance.runtime.minecraft
      const versions = await modrinth.getProjectVersions(input.project, {
        gameVersions: gameVersion ? [gameVersion] : undefined,
        loaders: input.loader ? [input.loader] : undefined,
      }, signal)
      return {
        project: input.project,
        versions: versions.slice(0, input.limit).map(version => ({
          id: version.id,
          name: version.name,
          versionNumber: version.version_number,
          gameVersions: version.game_versions,
          loaders: version.loaders,
          featured: version.featured,
          published: version.date_published,
          files: version.files.map(file => ({ filename: file.filename, size: file.size, primary: file.primary })),
          installRef: `modrinth:${input.project}@${version.id}`,
        })),
      }
    },
    async searchCurseforge(input, signal) {
      abortIfNeeded(signal)
      const instance = await currentInstance()
      const result = await curseforge.searchMods({
        searchFilter: input.query,
        classId: 6,
        gameVersion: input.gameVersion ?? instance.runtime.minecraft,
        pageSize: input.limit,
      }, signal)
      return {
        total: result.pagination.totalCount,
        projects: result.data.map(project => ({
          id: project.id,
          slug: project.slug,
          name: project.name,
          summary: project.summary,
          downloads: project.downloadCount,
          latestFiles: project.latestFilesIndexes?.slice(0, 8),
        })),
        next: 'Run `market curseforge files <projectId>` to resolve an installable file.',
      }
    },
    async getCurseforgeFiles(input, signal) {
      abortIfNeeded(signal)
      const instance = await currentInstance()
      const result = await curseforge.getModFiles({
        modId: input.project,
        gameVersion: input.gameVersion ?? instance.runtime.minecraft,
        pageSize: input.limit,
      }, signal)
      return {
        project: input.project,
        files: result.data.map(file => ({
          id: file.id,
          name: file.displayName,
          filename: file.fileName,
          gameVersions: file.gameVersions,
          releaseType: file.releaseType,
          published: file.fileDate,
          installRef: `curseforge:${input.project}/${file.id}`,
        })),
      }
    },
    async listLoaderVersions(input, signal) {
      abortIfNeeded(signal)
      const result = await loaderVersions(input.loader, input.minecraft, input.refresh)
      return {
        loader: input.loader,
        minecraft: result.minecraft,
        versions: result.versions.slice(0, input.limit).map((value: any) => typeof value === 'string'
          ? value
          : {
              version: value.version,
              type: value.type,
              stable: value.stable,
              date: value.date,
            }),
      }
    },
    async installLoader(input, signal) {
      abortIfNeeded(signal)
      const instance = await currentInstance()
      const minecraft = instance.runtime.minecraft
      if (!minecraft) throw new Error('The current instance has no Minecraft version')
      const available = await loaderVersions(input.loader, minecraft, false)
      let version = input.version
      let installedVersion: string
      if (input.loader === 'forge') {
        const forgeVersions = available.versions as Awaited<ReturnType<VersionMetadataService['getForgeVersions']>>
        const selected = version
          ? forgeVersions.find(value => value.version === version)
          : forgeVersions.find(value => value.type === 'recommended')
            ?? forgeVersions.find(value => value.type === 'latest')
            ?? forgeVersions[0]
        if (!selected) throw new Error(`No Forge version is available for Minecraft ${minecraft}`)
        version = selected.version
        abortIfNeeded(signal)
        installedVersion = await installer.installForge({
          mcversion: minecraft,
          version,
          installer: selected.installer,
        })
      } else if (input.loader === 'neoforge') {
        version ??= (available.versions as string[])[0]
        if (!version) throw new Error(`No NeoForge version is available for Minecraft ${minecraft}`)
        abortIfNeeded(signal)
        installedVersion = await installer.installNeoForged({ minecraft, version })
      } else if (input.loader === 'fabric') {
        version ??= (available.versions as Array<{ version: string }>).find(value => (value as any).stable !== false)?.version
          ?? (available.versions as Array<{ version: string }>)[0]?.version
        if (!version) throw new Error(`No Fabric version is available for Minecraft ${minecraft}`)
        abortIfNeeded(signal)
        installedVersion = await installer.installFabric({ minecraft, loader: version })
      } else {
        version ??= (available.versions as Array<{ version: string }>).find(value => (value as any).stable !== false)?.version
          ?? (available.versions as Array<{ version: string }>)[0]?.version
        if (!version) throw new Error(`No Quilt version is available for Minecraft ${minecraft}`)
        abortIfNeeded(signal)
        installedVersion = await installer.installQuilt({ minecraftVersion: minecraft, version })
      }

      const runtime = {
        ...instance.runtime,
        forge: '',
        neoForged: '',
        fabricLoader: '',
        quiltLoader: '',
        optifine: '',
        labyMod: '',
      }
      if (input.loader === 'forge') runtime.forge = version
      else if (input.loader === 'neoforge') runtime.neoForged = version
      else if (input.loader === 'fabric') runtime.fabricLoader = version
      else runtime.quiltLoader = version
      await instanceService.editInstance({ instancePath: key.scope, runtime, version: '' })
      return {
        ok: true,
        instance: key.scope,
        minecraft,
        loader: input.loader,
        version,
        installedVersion,
      }
    },
  }
}
