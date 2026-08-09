import type { AgentTool } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'
import { useRendererCommandHost } from '@/composables/commandHost'
import { sortNeoForgeVersions } from '@/composables/neoForgeVersion'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import type { EditInstanceOptions, InstanceFile, PartialRuntimeVersions } from '@xmcl/instance'
import type { Resource } from '@xmcl/resource'
import { FileModLoaderType, type ModsSearchSortField } from '@xmcl/curseforge'
import {
  formatCommandHelp,
  type AgentMarketProjectListPresentation,
  AgentServiceKey,
  BaseServiceKey,
  InstanceInstallServiceKey,
  InstanceLogServiceKey,
  InstanceModsServiceKey,
  InstanceOptionsServiceKey,
  InstanceResourcePacksServiceKey,
  InstanceSavesServiceKey,
  InstanceServiceKey,
  InstanceShaderPacksServiceKey,
  LaunchServiceKey,
  MarketRefInputSchema,
  MarketType,
  parseShaderOptions,
  parseCli,
  RemoteServerServiceKey,
  stringifyShaderOptions,
  ThemeServiceKey,
  VersionMetadataServiceKey,
} from '@xmcl/runtime-api'
import { useService } from '../service'
import { confirmAgentAction, requestAgentConfirmation } from './confirm'
import { type AgentCommandOperations, type AgentLoader, assertAgentCommandSyntax, createAgentRuntimeCommandIndex, createAgentRuntimeCommands, executeAgentRuntimeCommand, formatAgentRuntimeCommandHelp, withModrinthSearchInstallRef } from './commands'
import type { AgentRunContext } from './local'
import { createAgentUiHandler } from './ui'
import { kInstances } from '../instances'
import { kUserContext } from '../user'
import { useAgentCapabilityContext } from './capabilityContext'
import { actionObjectSchema, textResult } from './toolSupport'
import { buildAgentInstanceEdit, createAgentStagedInstallPresenter, isAgentCommandAllowed } from './toolPolicy'
import { applyVfsWriteChange, assertVfsRevision, createVfsLaunchEntries, createVfsRevision, createVfsRootEntries, filterAgentLogFiles, normalizeVfsListPath, normalizeVfsPath, normalizeVfsWriteContent, resolveExistingVfsWrite, summarizeVfsTextChange, validateVfsText } from './vfs'
import { CurseforgeBuiltinClassId } from '../curseforge'
import { kModrinthAuthenticatedAPI } from '../modrinthAuthenticatedAPI'
import { getAgentInstanceLoader, resolveAgentMarketFilters } from './marketFilters'
import { getModrinthDependenciesModel } from '../modrinthDependencies'
import { getCurseforgeDependenciesModel } from '../curseforgeDependencies'
import { kSWRVConfig } from '../swrvConfig'
import { resolveArtifactModrinthDependencies } from '../modArtifactDependencies'
import { getReplacedModFiles, getRequiredCurseforgeInstallFiles, getRequiredModrinthInstallVersions } from '../modInstall'
import { createAgentManifestApplyResult, getAgentModCompatibilityGuidance, isAgentRuntimeCompatibilityChanged } from './modDiagnosis'

interface AgentRuntimeChangeTracker {
  pending: boolean
}

function grepSnippet(line: string, matchIndex: number) {
  if (line.length <= 400) return line
  const contentLength = 394
  const start = Math.min(Math.max(0, matchIndex - 120), line.length - contentLength)
  const end = start + contentLength
  return `${start > 0 ? '...' : ''}${line.slice(start, end)}${end < line.length ? '...' : ''}`
}

function tokenize(input: string) {
  const tokens: string[] = []
  let token = ''
  let quote = ''
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quote) {
      if (char === quote) quote = ''
      else if (char === '\\' && quote === '"' && i + 1 < input.length) token += input[++i]
      else token += char
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (/\s/.test(char)) {
      if (token) {
        tokens.push(token)
        token = ''
      }
    } else {
      token += char
    }
  }
  if (quote) throw new Error('Unterminated quote')
  if (token) tokens.push(token)
  return tokens
}

/** Max resource entries returned per `vfs_list` page, to bound prompt size. */
const RESOURCE_LIST_LIMIT = 10

function summarizeResource(resource: Resource) {
  return {
    name: resource.name,
    fileName: resource.fileName,
    path: resource.path,
    size: resource.size,
    hash: resource.hash,
    metadata: resource.metadata,
  }
}

function compatibilityLabel(compatible: number | undefined) {
  if (compatible === undefined) return 'unknown'
  if (compatible === 0) return 'matched'
  if (compatible === 1) return 'may-incompatible'
  if (compatible === 2) return 'very-likely-incompatible'
  return String(compatible)
}

function decorateModrinthVersions(value: any): any {
  if (Array.isArray(value)) return value.map(decorateModrinthVersions)
  if (!value || typeof value !== 'object') return value
  if (typeof value.id === 'string' && typeof value.project_id === 'string' && Array.isArray(value.files)) {
    return { ...value, installRef: `modrinth:${value.project_id}@${value.id}` }
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decorateModrinthVersions(entry)]))
}

function decorateCurseforgeFiles(value: any): any {
  if (Array.isArray(value)) return value.map(decorateCurseforgeFiles)
  if (!value || typeof value !== 'object') return value
  if (Number.isSafeInteger(value.id) && Number.isSafeInteger(value.modId) && typeof value.fileName === 'string') {
    return { ...value, installRef: `curseforge:${value.modId}/${value.id}` }
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decorateCurseforgeFiles(entry)]))
}

function summarizeInstallInstruction(instruction: ReturnType<typeof useAgentCapabilityContext>['context']['installInstruction']['value']) {
  if (!instruction) return { available: false, note: 'Installation diagnosis is not available yet.' }
  const missingLibraries = instruction.libraries?.length ?? 0
  const missingAssets = instruction.assets?.length ?? 0
  const issues: string[] = []
  if (!instruction.resolvedVersion) issues.push('version is not resolved')
  if (instruction.jar) issues.push(`minecraft jar missing or corrupted (${instruction.jar})`)
  if (instruction.forge) issues.push(`forge is not installed (${instruction.forge.version})`)
  if (instruction.optifine) issues.push(`optifine is not installed (${instruction.optifine})`)
  if (instruction.profile) issues.push('mod-loader install profile must run')
  if (instruction.assetsIndex) issues.push('assets index missing or corrupted')
  if (missingLibraries) issues.push(`${missingLibraries} libraries missing or corrupted`)
  if (missingAssets) issues.push(`${missingAssets} assets missing`)
  if (instruction.java) issues.push(`required Java ${instruction.java.majorVersion} is not installed`)
  return {
    available: true,
    instance: instruction.instance,
    runtime: instruction.runtime,
    selectedVersion: instruction.version,
    resolvedVersion: instruction.resolvedVersion,
    healthy: issues.length === 0,
    issues,
    counts: { libraries: missingLibraries, assets: missingAssets },
  }
}

function confirmAgentActionForRun(context: AgentRunContext, input: Parameters<typeof confirmAgentAction>[0], signal?: AbortSignal) {
  return confirmAgentAction(input, signal, context.permissionScope)
}

function confirmInstall(context: AgentRunContext, title: string, message: string, detail: string, destructive = false) {
  return confirmAgentAction({
    title,
    message,
    details: [detail],
    confirmLabel: destructive ? 'Delete' : 'Install',
    destructive,
  }, undefined, context.permissionScope)
}

export function useAgentToolFactory() {
  const baseService = useService(BaseServiceKey)
  const modsService = useService(InstanceModsServiceKey)
  const resourcePackService = useService(InstanceResourcePacksServiceKey)
  const shaderPackService = useService(InstanceShaderPacksServiceKey)
  const savesService = useService(InstanceSavesServiceKey)
  const optionsService = useService(InstanceOptionsServiceKey)
  const logService = useService(InstanceLogServiceKey)
  const launchService = useService(LaunchServiceKey)
  const instanceService = useService(InstanceServiceKey)
  const metadata = useService(VersionMetadataServiceKey)
  const remoteServerService = useService(RemoteServerServiceKey)
  const instanceInstall = useService(InstanceInstallServiceKey)
  const agentService = useService(AgentServiceKey)
  const instances = injection(kInstances)
  const user = injection(kUserContext)
  const modrinthAuthenticatedAPI = injection(kModrinthAuthenticatedAPI)
  const swrvConfig = injection(kSWRVConfig)
  const router = useRouter()
  const commandHost = useRendererCommandHost()
  const capabilities = useAgentCapabilityContext()
  const versionService = capabilities.services.versionService

  const uiHandler = createAgentUiHandler({
    router,
    selectedInstance: instances.selectedInstance,
    instances: instances.allInstances,
    selectAccount: user.select,
    confirm: requestAgentConfirmation,
  })

  function currentInstance(context: AgentRunContext) {
    const instance = instances.allInstances.value.find(value => value.path === context.scope)
    if (!instance) throw new Error(`Current instance is unavailable: ${context.scope}`)
    return instance
  }

  async function createVfsTools(context: AgentRunContext, runtimeChange: AgentRuntimeChangeTracker): Promise<{
    tools: AgentTool[]
    list: (path: string, offset?: number) => Promise<unknown>
    read: (path: string, tailLines?: number, offset?: number, limit?: number) => Promise<unknown>
    remove: (paths: string[]) => Promise<unknown>
  }> {
    const instancePath = context.scope
    const artifactKey = { agentId: context.agentId, scope: context.scope }
    const resources = async (kind: 'mods' | 'resourcepacks' | 'shaderpacks') => {
      const service = kind === 'mods' ? modsService : kind === 'resourcepacks' ? resourcePackService : shaderPackService
      return (await service.watch(instancePath)).files
    }
    const list = async (path: string, listOffset?: number) => {
      const clean = normalizeVfsListPath(path, instancePath)
      if (!clean) {
        const inspect = async <T>(operation: () => Promise<T>) => {
          try {
            return await operation()
          } catch {
            return undefined
          }
        }
        const [
          mods,
          resourcePacks,
          shaderPacks,
          gameOptions,
          shaderOptions,
          saves,
          logs,
          crashReports,
          launches,
          configFiles,
          gameProcesses,
          artifacts,
        ] = await Promise.all([
          inspect(() => resources('mods')),
          inspect(() => resources('resourcepacks')),
          inspect(() => resources('shaderpacks')),
          inspect(() => optionsService.getGameOptions(instancePath)),
          inspect(() => optionsService.getShaderOptions(instancePath)),
          inspect(async () => (await savesService.watch(instancePath)).saves),
          inspect(async () => filterAgentLogFiles(await logService.listLogs(instancePath))),
          inspect(async () => filterAgentLogFiles(await logService.listCrashReports(instancePath))),
          inspect(() => logService.listLaunches(instancePath)),
          inspect(() => optionsService.getInstanceConfigFiles(instancePath)),
          inspect(async () => (await launchService.getGameProcesses()).filter(process => process.options.gameDirectory === instancePath)),
          inspect(() => agentService.listArtifacts(artifactKey)),
        ])
        const enabledResourcePacks = gameOptions?.resourcePacks
          ? new Set(gameOptions.resourcePacks.map(name => name.replace(/^file\//, '')))
          : undefined
        const selectedShaderPack = shaderOptions?.shaderPack
        const remoteServer = currentInstance(context).remoteServer
        return {
          path: '.',
          entries: createVfsRootEntries({
            mods: mods && {
              total: mods.length,
              enabled: mods.filter(resource => !resource.fileName.endsWith('.disabled')).length,
              disabled: mods.filter(resource => resource.fileName.endsWith('.disabled')).length,
            },
            resourcePacks: resourcePacks && enabledResourcePacks && {
              total: resourcePacks.length,
              enabled: resourcePacks.filter(resource => enabledResourcePacks.has(resource.fileName)).length,
              disabled: resourcePacks.filter(resource => !enabledResourcePacks.has(resource.fileName)).length,
            },
            shaderPacks: shaderPacks && shaderOptions && {
              total: shaderPacks.length,
              enabled: shaderPacks.filter(resource => resource.fileName === selectedShaderPack).length,
              disabled: shaderPacks.filter(resource => resource.fileName !== selectedShaderPack).length,
            },
            saves: saves?.length,
            logs: logs?.length,
            crashReports: crashReports?.length,
            launches: launches?.length,
            config: configFiles?.length,
            artifacts: artifacts?.length,
            gameProcesses: gameProcesses?.length,
            remoteServer: remoteServer ? `${remoteServer.username}@${remoteServer.host}` : undefined,
          }),
        }
      }
      if (clean === 'mods' || clean === 'resourcepacks' || clean === 'shaderpacks') {
        // Instances can hold hundreds of mods; sending them all would blow the
        // context window, so only a page is returned and the rest is summarized.
        const all = await resources(clean)
        const offset = Number.isFinite(listOffset) ? Math.max(0, Math.trunc(listOffset as number)) : 0
        const page = all.slice(offset, offset + RESOURCE_LIST_LIMIT)
        return {
          path: clean,
          total: all.length,
          offset,
          limit: RESOURCE_LIST_LIMIT,
          truncated: all.length > offset + page.length,
          entries: page.map(summarizeResource),
        }
      }
      if (clean === 'saves') return (await savesService.watch(instancePath)).saves
      if (clean === 'logs') return filterAgentLogFiles(await logService.listLogs(instancePath))
      if (clean === 'crash-reports') return filterAgentLogFiles(await logService.listCrashReports(instancePath))
      if (clean === 'launches') {
        return (await logService.listLaunches(instancePath)).map(record => ({
          name: record.launchId,
          path: `launches/${record.launchId}`,
          type: 'folder',
          summary: `${record.side} ${record.version}; ${record.state}${record.exitCode === undefined ? '' : ` with exit code ${record.exitCode}`}; started ${new Date(record.startedAt).toISOString()}.`,
        }))
      }
      if (clean.startsWith('launches/')) {
        const launchId = clean.slice('launches/'.length)
        if (launchId.includes('/')) throw new Error(`Not a virtual directory: ${path}`)
        const launches = await logService.listLaunches(instancePath)
        const record = launchId === 'latest' ? launches[0] : launches.find(value => value.launchId === launchId)
        if (!record) throw new Error(`Launch not found: ${launchId}`)
        return createVfsLaunchEntries(record)
      }
      if (clean === 'config') return optionsService.getInstanceConfigFiles(instancePath)
      if (clean === 'artifacts') {
        return (await agentService.listArtifacts(artifactKey)).map(artifact => ({
          name: artifact.path.slice('artifacts/'.length),
          path: artifact.path,
          type: 'file',
          summary: `${artifact.length} characters; created ${new Date(artifact.createdAt).toISOString()}.`,
        }))
      }
      if (clean === 'server') {
        return ['server.properties', 'eula.txt', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'usercache.json', 'logs']
      }
      if (clean === 'server/logs') return filterAgentLogFiles(await logService.listServerLogs(instancePath))
      if (clean === 'remote') return ['server']
      if (clean === 'remote/server') return ['server.properties', 'eula.txt', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'usercache.json', 'logs']
      if (clean === 'remote/server/logs') return ['latest.log']
      if (clean === 'game-processes') return (await launchService.getGameProcesses()).filter(process => process.options.gameDirectory === instancePath)
      throw new Error(`Not a virtual directory: ${path}`)
    }
    const read = async (path: string, tailLines?: number, offset?: number, limit?: number) => {
      const clean = normalizeVfsPath(path, instancePath)
      if (clean.startsWith('artifacts/')) return agentService.readArtifact(artifactKey, { path: clean, offset, limit })
      if (clean === 'instance.json') return currentInstance(context)
      if (clean === 'options.txt') return optionsService.getGameOptions(instancePath)
      if (clean === 'optionsshaders.txt') {
        const content = stringifyShaderOptions(await optionsService.getShaderOptions(instancePath))
        return { path: clean, content, revision: await createVfsRevision(content) }
      }
      const [kind, ...parts] = clean.split('/')
      const rest = parts.join('/')
      if (kind === 'launches') {
        const [launchName, evidenceName, ...extra] = parts
        if (!launchName || !evidenceName || extra.length) return { error: `invalid launch evidence path: ${rest}` }
        const launches = await logService.listLaunches(instancePath)
        const record = launchName === 'latest' ? launches[0] : launches.find(value => value.launchId === launchName)
        if (!record) return { error: `launch not found: ${launchName}` }
        if (evidenceName === 'summary.json') return record
        if (evidenceName !== 'game.log' && evidenceName !== 'debug.log' && evidenceName !== 'crash-report.txt' && evidenceName !== 'launcher-output.log') {
          return { error: `unknown launch evidence: ${evidenceName}` }
        }
        const content = await logService.getLaunchEvidence(instancePath, record.launchId, evidenceName)
        return content.split('\n').slice(-Math.min(Math.max(1, tailLines ?? 200), 2000)).join('\n')
      }
      if (kind === 'mods' || kind === 'resourcepacks' || kind === 'shaderpacks') {
        const resource = (await resources(kind)).find(value => value.fileName === rest || value.path === rest || value.name === rest)
        return resource ? summarizeResource(resource) : { error: `${kind} entry not found: ${rest}` }
      }
      if (kind === 'saves') {
        return (await savesService.watch(instancePath)).saves.find(value => value.name === rest || value.path === rest)
          ?? { error: `save not found: ${rest}` }
      }
      if (kind === 'logs') {
        const content = await logService.getLogContent(instancePath, rest)
        return content.split('\n').slice(-Math.min(Math.max(1, tailLines ?? 200), 2000)).join('\n')
      }
      if (kind === 'crash-reports') return logService.getCrashReportContent(instancePath, rest)
      if (kind === 'config') {
        const content = await optionsService.getInstanceConfig(instancePath, rest)
        return { path: clean, content, revision: await createVfsRevision(content) }
      }
      if (kind === 'server') {
        if (parts[0] === 'logs') {
          const content = await logService.getServerLogContent(instancePath, parts.slice(1).join('/'))
          return content.split('\n').slice(-Math.min(Math.max(1, tailLines ?? 200), 2000)).join('\n')
        }
        const content = await optionsService.getServerFile(instancePath, rest)
        return { path: clean, content, revision: await createVfsRevision(content) }
      }
      if (kind === 'remote') {
        if (!currentInstance(context).remoteServer) throw new Error('No remote server is configured for this instance')
        if (parts[0] !== 'server') throw new Error(`Unknown remote virtual path: ${path}`)
        const remotePath = parts.slice(1).join('/')
        if (remotePath === 'logs/latest.log') {
          return remoteServerService.tailLog(instancePath, Math.min(Math.max(1, tailLines ?? 200), 2000))
        }
        const content = await remoteServerService.readRemoteFile(instancePath, remotePath)
        return { path: clean, content, revision: await createVfsRevision(content) }
      }
      if (kind === 'game-processes') return await launchService.getGameProcess(Number(parts.at(-1))) ?? { error: `game process not found: ${rest}` }
      return { error: `unknown virtual path: ${path}` }
    }

    const remove = async (paths: string[]) => {
      const changes: Array<{
        path: string
        staged?: InstanceFile
        remove?: () => Promise<void>
      }> = []
      for (const input of paths) {
        const path = normalizeVfsPath(input, instancePath)
        const [kind, ...parts] = path.split('/')
        const rest = parts.join('/')
        if (kind === 'mods' || kind === 'resourcepacks' || kind === 'shaderpacks') {
          const resource = (await resources(kind)).find(value => value.fileName === rest || value.path === rest || value.name === rest)
          if (!resource) throw new Error(`${kind} entry not found: ${rest}`)
          changes.push({
            path,
            staged: {
              path: `${kind}/${resource.fileName}`,
              hashes: { sha1: resource.hash },
              size: resource.size,
              ...(resource.metadata.modrinth ? { modrinth: resource.metadata.modrinth } : {}),
              ...(resource.metadata.curseforge ? { curseforge: resource.metadata.curseforge } : {}),
            },
          })
        } else if (kind === 'saves') changes.push({ path, remove: () => savesService.deleteSave({ instancePath, saveName: rest }) })
        else if (kind === 'logs') changes.push({ path, remove: () => logService.removeLog(instancePath, rest) })
        else if (kind === 'crash-reports') changes.push({ path, remove: () => logService.removeCrashReport(instancePath, rest) })
        else if (kind === 'config') changes.push({ path, remove: () => optionsService.removeInstanceConfig(instancePath, rest) })
        else throw new Error(`Unsupported delete path: ${path}`)
      }

      const immediate = changes.filter((change): change is typeof change & { remove: () => Promise<void> } => !!change.remove)
      if (immediate.length) {
        await confirmInstall(
          context,
          'Delete instance files',
          `Delete ${immediate.length} path${immediate.length === 1 ? '' : 's'} from the selected instance?`,
          immediate.map(change => change.path).join('\n'),
          true,
        )
      }

      const staged = changes.flatMap(change => change.staged ? [change.staged] : [])
      if (staged.length) await instanceInstall.stageInstanceFiles({ path: instancePath, oldFiles: staged, files: [] })
      for (const change of immediate) await change.remove()

      return {
        ok: true,
        staged: staged.length,
        deleted: immediate.length,
        results: changes.map(change => change.staged
          ? { stagedForRemoval: change.path }
          : { deleted: change.path }),
        ...(staged.length ? {
          message: `${staged.length} resource${staged.length === 1 ? '' : 's'} ${staged.length === 1 ? 'has' : 'have'} been staged for removal.`,
          guidance: 'No files have been removed yet. Review with `instance manifest status`, then run `instance manifest apply` to apply all pending changes.',
        } : {}),
      }
    }

    return {
      list,
      read,
      remove,
      tools: [
      {
        name: 'vfs_list',
        label: 'List instance files',
        description: `List a virtual directory for the explicitly selected instance. Resource directories (mods, resourcepacks, shaderpacks) return at most ${RESOURCE_LIST_LIMIT} entries per call; use offset to page through the rest.`,
        parameters: Type.Object({ path: Type.Optional(Type.String()), offset: Type.Optional(Type.Number()) }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          return textResult(await list(String(args.path ?? ''), args.offset))
        },
      },
      {
        name: 'vfs_read',
        label: 'Read instance data',
        description: 'Read a virtual instance file, resource entry, or temporary Agent artifact. Artifact reads support character offset and limit pagination.',
        parameters: Type.Object({ path: Type.String(), tailLines: Type.Optional(Type.Number()), offset: Type.Optional(Type.Number()), limit: Type.Optional(Type.Number()) }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          return textResult(await read(args.path, args.tailLines, args.offset, args.limit))
        },
      },
      {
        name: 'vfs_write',
        label: 'Write instance file',
        description: 'Create or edit one allowlisted virtual config or server file. Read first and pass its revision. Provide content for a full rewrite, or replacements for sequential exact literal search/replace edits. Each replacement changes the first match by default; set all=true only to replace every match.',
        parameters: Type.Object({
          path: Type.String({ description: 'Relative instance VFS path.' }),
          baseRevision: Type.Union([Type.String(), Type.Null()], { description: 'Revision returned by vfs_read, or null only when creating a new file.' }),
          create: Type.Optional(Type.Boolean({ description: 'Set true only to create a missing config file.' })),
          content: Type.Optional(Type.String({ description: 'Complete replacement content. Mutually exclusive with replacements.' })),
          replacements: Type.Optional(Type.Array(Type.Object({
            match: Type.String({ description: 'Exact literal text to find in the current file content.' }),
            replace: Type.String({ description: 'Literal replacement text.' }),
            all: Type.Optional(Type.Boolean({ description: 'Replace every occurrence. Defaults to false (first occurrence only).' })),
          }), { description: 'Sequential exact literal edits. Mutually exclusive with content.' })),
        }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          const path = normalizeVfsPath(String(args.path), instancePath)
          const serverFiles = new Set(['server.properties', 'eula.txt', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json'])
          const isConfig = path.startsWith('config/')
          const isShaderOptions = path === 'optionsshaders.txt'
          const serverFile = path.startsWith('server/') ? path.slice('server/'.length) : ''
          const isServerFile = serverFiles.has(serverFile)
          const remoteServerFile = path.startsWith('remote/server/') ? path.slice('remote/server/'.length) : ''
          const isRemoteServerFile = serverFiles.has(remoteServerFile)
          if (!isConfig && !isServerFile && !isRemoteServerFile && !isShaderOptions) throw new Error(`Unsupported write path: ${path}`)
          const instance = currentInstance(context)
          if (isRemoteServerFile && !instance.remoteServer) throw new Error('No remote server is configured for this instance')
          const relativePath = isConfig ? path.slice('config/'.length) : isServerFile ? serverFile : isRemoteServerFile ? remoteServerFile : path
          const validationPath = isRemoteServerFile ? `server/${remoteServerFile}` : path
          if (!relativePath) throw new Error('A file path is required')

          const hasContent = typeof args.content === 'string'
          const hasReplacements = Array.isArray(args.replacements)
          if (hasContent === hasReplacements) throw new Error('Provide exactly one of content or replacements')

          const files = isConfig ? await optionsService.getInstanceConfigFiles(instancePath) : []
          const exists = isServerFile || isRemoteServerFile || isShaderOptions || files.includes(relativePath)
          if (!exists && !args.create) throw new Error(`Config file not found: ${path}`)
          if (exists && args.create) throw new Error(`File already exists: ${path}`)
          if (!exists && args.baseRevision !== null) throw new Error('baseRevision must be null when creating a file')
          if (exists && typeof args.baseRevision !== 'string') throw new Error('baseRevision is required when editing a file')

          const getContent = () => isServerFile
            ? optionsService.getServerFile(instancePath, relativePath)
            : isRemoteServerFile
              ? remoteServerService.readRemoteFile(instancePath, relativePath)
              : isShaderOptions
                ? optionsService.getShaderOptions(instancePath).then(stringifyShaderOptions)
                : optionsService.getInstanceConfig(instancePath, relativePath)
          const current = exists ? await getContent() : ''
          const change = hasContent
            ? { content: args.content as string }
            : { replacements: args.replacements }
          const resolved = exists
            ? await resolveExistingVfsWrite(path, current, args.baseRevision, change)
            : {
                oldRevision: await createVfsRevision(current),
                content: normalizeVfsWriteContent(path, applyVfsWriteChange(current, change)),
                alreadyApplied: false,
              }
          const { oldRevision, content: next } = resolved
          if (resolved.alreadyApplied) {
              return textResult({
                ok: true,
                path,
                oldRevision,
                newRevision: oldRevision,
                unchanged: true,
                note: 'The requested content is already present.',
              })
          }
          if (next === current) throw new Error(`No changes to write for ${path}`)
          const bytes = validateVfsText(validationPath, next)
          const diff = summarizeVfsTextChange(current, next)
          const remoteTarget = isRemoteServerFile
            ? `${instance.remoteServer!.username}@${instance.remoteServer!.host}:${instance.remoteServer!.remotePath}`
            : undefined
          const acceptingEula = validationPath === 'server/eula.txt' && next.trim() === 'eula=true'
          const confirmationDetails = [
            ...(remoteTarget ? [remoteTarget] : []),
            ...(acceptingEula ? ['https://aka.ms/MinecraftEULA'] : []),
            ...diff.details,
          ]

          await confirmAgentActionForRun(context, {
            title: acceptingEula
              ? 'Accept Minecraft EULA'
              : isRemoteServerFile ? 'Edit remote server file' : exists ? 'Edit instance file' : 'Create instance file',
            message: `${exists ? 'Write changes to' : 'Create'} ${path}?`,
            details: confirmationDetails.length ? confirmationDetails : [`${bytes} bytes`],
            confirmLabel: exists ? 'Apply' : 'Create',
            destructive: isRemoteServerFile || acceptingEula,
          })

          if (exists) {
            const latest = await getContent()
            await assertVfsRevision(latest, oldRevision, path)
          } else if (isConfig && (await optionsService.getInstanceConfigFiles(instancePath)).includes(relativePath)) {
            throw new Error(`Config file was created while awaiting confirmation: ${path}`)
          }

          if (isServerFile) await optionsService.setServerFile(instancePath, relativePath, next)
          else if (isRemoteServerFile) await remoteServerService.writeRemoteFile(instancePath, relativePath, next)
          else if (isShaderOptions) await optionsService.editShaderOptions({ ...parseShaderOptions(next), instancePath })
          else await optionsService.setInstanceConfig(instancePath, relativePath, next)
          const written = await getContent()
          if (written !== next) throw new Error(`Write verification failed for ${path}`)
          return textResult({
            ok: true,
            path,
            oldRevision: exists ? oldRevision : null,
            newRevision: await createVfsRevision(written),
            bytes,
            changedLines: diff.changedLines,
            diffTruncated: diff.truncated,
          })
        },
      },
      {
        name: 'vfs_rm',
        label: 'Delete instance files',
        description: 'Stage removals under mods, resourcepacks, and shaderpacks in the instance manifest. Delete other supported virtual paths after explicit user confirmation.',
        parameters: Type.Object({ paths: Type.Array(Type.String()) }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          return textResult(await remove(args.paths))
        },
      },
      {
        name: 'edit_instance',
        label: 'Edit instance',
        description: 'Edit allowlisted non-runtime fields on the selected instance. Use `instance runtime set` for Minecraft and mod-loader changes.',
        parameters: Type.Object({
          name: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          java: Type.Optional(Type.String()),
          minMemory: Type.Optional(Type.Number()),
          maxMemory: Type.Optional(Type.Number()),
          assignMemory: Type.Optional(Type.Union([Type.Boolean(), Type.Literal('auto')])),
          vmOptions: Type.Optional(Type.Array(Type.String())),
          mcOptions: Type.Optional(Type.Array(Type.String())),
          env: Type.Optional(Type.Record(Type.String(), Type.String())),
          resolution: Type.Optional(Type.Object({
            width: Type.Optional(Type.Number()),
            height: Type.Optional(Type.Number()),
            fullscreen: Type.Optional(Type.Boolean()),
          })),
          fastLaunch: Type.Optional(Type.Boolean()),
          showLog: Type.Optional(Type.Boolean()),
          hideLauncher: Type.Optional(Type.Boolean()),
          prependCommand: Type.Optional(Type.String()),
          preExecuteCommand: Type.Optional(Type.String()),
        }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          const { payload, edited } = buildAgentInstanceEdit(instancePath, args)
          if (!edited.length) throw new Error('No editable fields were provided')
          await instanceService.editInstance(payload as EditInstanceOptions & { instancePath: string })
          return textResult({ ok: true, edited })
        },
      },
      ],
    }
  }

  function loaderVersions(loader: AgentLoader, minecraft: string, refresh: boolean) {
    if (loader === 'forge') return metadata.getForgeVersions(minecraft, refresh)
    if (loader === 'neoforge') return metadata.getNeoForgedVersions(minecraft, refresh)
    return loader === 'fabric' ? metadata.getFabricVersions(refresh) : metadata.getQuiltVersions(refresh)
  }

  function currentLoader(context: AgentRunContext): AgentLoader | undefined {
    return getAgentInstanceLoader(currentInstance(context).runtime)
  }

  function curseforgeLoaderName(loader: AgentLoader) {
    return loader === 'neoforge' ? 'NeoForge' : loader[0].toUpperCase() + loader.slice(1)
  }

  function curseforgeLoaderType(loader: string | undefined) {
    if (!loader) return undefined
    const values: Record<string, FileModLoaderType> = {
      forge: FileModLoaderType.Forge,
      fabric: FileModLoaderType.Fabric,
      quilt: FileModLoaderType.Quilt,
      neoforge: FileModLoaderType.NeoForge,
    }
    const result = values[loader.toLowerCase()]
    if (result === undefined) throw new Error(`Unknown CurseForge loader: ${loader}`)
    return result
  }

  function resolveArtifactDependencies(
    url: string | undefined,
    context: AgentRunContext,
    selectedProjects: Set<string>,
  ) {
    const loader = currentLoader(context)
    return resolveArtifactModrinthDependencies({
      url,
      loader,
      minecraft: currentInstance(context).runtime.minecraft,
      installedMods: capabilities.context.mods.value,
      selectedProjects,
      client: clientModrinthV2,
    })
  }

  async function stageModWithDependencies(input: Record<string, any>, context: AgentRunContext) {
    const marketRef = MarketRefInputSchema.parse(input.ref)
    if (marketRef.source === 'file' || marketRef.source === 'url') {
      return commandHost.dispatch('mod.install', input)
    }
    const instance = currentInstance(context)
    const installedModrinth = new Set(capabilities.context.mods.value.flatMap(mod => mod.modrinth?.projectId ? [mod.modrinth.projectId] : []))
    const installedCurseforge = new Set(capabilities.context.mods.value.flatMap(mod => mod.curseforge?.projectId ? [mod.curseforge.projectId] : []))
    let files: InstanceFile[]
    if (marketRef.source === 'modrinth') {
      if (!marketRef.version) throw new Error(`Missing version for modrinth:${marketRef.project}. Use modrinth:${marketRef.project}@<versionId>.`)
      const version = await clientModrinthV2.getProjectVersion(marketRef.version)
      const dependencies = input.dependencies === false
        ? []
        : await getSWRV(getModrinthDependenciesModel(ref(version), currentLoader(context), swrvConfig), swrvConfig) ?? []
      const selectedProjects = new Set([version.project_id, ...dependencies.map(dependency => dependency.project.id)])
      const artifactDependencies = input.dependencies === false
        ? []
        : await resolveArtifactDependencies((version.files.find(file => file.primary) ?? version.files[0])?.url, context, selectedProjects)
      const versions = [...getRequiredModrinthInstallVersions(version, dependencies, installedModrinth), ...artifactDependencies]
      files = await modsService.resolveFromMarket({ market: MarketType.Modrinth, version: versions, instancePath: context.scope })
    } else {
      if (!marketRef.file) throw new Error(`Missing fileId for curseforge:${marketRef.project}. Use curseforge:${marketRef.project}/<fileId>.`)
      const file = await clientCurseforgeV1.getModFile(marketRef.project, marketRef.file)
      const dependencies = input.dependencies === false
        ? []
        : await getSWRV(getCurseforgeDependenciesModel(
            ref(file),
            ref(instance.runtime.minecraft),
            ref(curseforgeLoaderType(currentLoader(context)) ?? FileModLoaderType.Any),
            swrvConfig,
          ), swrvConfig) ?? []
      const filesToResolve = getRequiredCurseforgeInstallFiles(file, dependencies, installedCurseforge)
      files = await modsService.resolveFromMarket({ market: MarketType.CurseForge, file: filesToResolve, instancePath: context.scope })
      const artifactDependencies = input.dependencies === false
        ? []
        : await resolveArtifactDependencies(file.downloadUrl, context, new Set())
      if (artifactDependencies.length) {
        files.push(...await modsService.resolveFromMarket({ market: MarketType.Modrinth, version: artifactDependencies, instancePath: context.scope }))
      }
    }
    const oldFiles = getReplacedModFiles(files, capabilities.context.mods.value)
    const manifest = await instanceInstall.stageInstanceFiles({ path: context.scope, oldFiles, files })
    return {
      files: files.map(file => file.path),
      manifest: {
        files: manifest.files.map(file => file.path),
        oldFiles: manifest.oldFiles.map(file => file.path),
      },
    }
  }

  function createCommandOperations(context: AgentRunContext, vfs: Awaited<ReturnType<typeof createVfsTools>>, runtimeChange: AgentRuntimeChangeTracker): AgentCommandOperations {
    const diagnoseRuntimeMods = async () => {
      try {
        const modDiagnosis = await capabilities.context.diagnoseModCompatibility({ added: [], removed: [] }) as any
        return { modDiagnosis, guidance: getAgentModCompatibilityGuidance(modDiagnosis) }
      } catch (error) {
        return {
          modDiagnosis: { status: 'error', error: error instanceof Error ? error.message : String(error) },
          guidance: ['Mod compatibility diagnosis failed. Run `mod update check` without `--skip-version` before launching.'],
        }
      }
    }
    const artifactKey = { agentId: context.agentId, scope: context.scope }
    return {
      listVfs: path => vfs.list(path),
      readVfs: (input) => vfs.read(input.path, input.tailLines, input.offset, input.limit),
      removeVfs: vfs.remove,
      listDocuments: () => agentService.listDocuments(),
      searchDocuments: input => agentService.searchDocuments(input),
      readDocument: id => agentService.readDocument(id),
      getSystemInfo: signal => baseService.getSystemInfo(context.scope),
      async queryModrinth(input, signal) {
        if (input.kind === 'tags') {
          if (input.tag === 'loaders') return clientModrinthV2.getLoaderTags(signal)
          if (input.tag === 'game-versions') return clientModrinthV2.getGameVersionTags(signal)
          return clientModrinthV2.getLicenseTags(signal)
        }
        if (input.kind === 'projects') {
          return input.ids.length === 1
            ? clientModrinthV2.getProject(input.ids[0], signal)
            : clientModrinthV2.getProjects(input.ids, signal)
        }
        if (input.kind === 'versions') {
          const result = input.ids.length === 1
            ? clientModrinthV2.getProjectVersion(input.ids[0], signal)
            : clientModrinthV2.getProjectVersionsById(input.ids, signal)
          return decorateModrinthVersions(await result)
        }
        if (input.kind === 'versions-by-hash') {
          if (input.latest) {
            const options = { algorithm: input.algorithm, loaders: input.loaders, gameVersions: input.gameVersions }
            const result = input.hashes.length === 1
              ? clientModrinthV2.getLatestProjectVersion(input.hashes[0], options, signal)
              : clientModrinthV2.getLatestVersionsFromHashes(input.hashes, options, signal)
            return decorateModrinthVersions(await result)
          }
          const result = input.hashes.length === 1
            ? clientModrinthV2.getProjectVersionByHash(input.hashes[0], { algorithm: input.algorithm, multiple: input.multiple }, signal)
            : clientModrinthV2.getProjectVersionsByHash(input.hashes, input.algorithm, signal)
          return decorateModrinthVersions(await result)
        }
        if (input.kind === 'authenticated-user') {
          await modrinthAuthenticatedAPI.interact()
          const authenticatedUser = modrinthAuthenticatedAPI.userData.value
          if (!authenticatedUser) throw new Error('Modrinth login is required')
          return authenticatedUser
        }
        if (input.kind === 'team') return clientModrinthV2.getProjectTeamMembers(input.project, signal)
        if (input.related === 'projects') return clientModrinthV2.getUserProjects(input.id, signal)
        if (input.related === 'followed') return clientModrinthV2.getUserFollowedProjects(input.id, signal)
        if (input.related === 'collections') return clientModrinthV2.getCollections(input.id, signal)
        return clientModrinthV2.getUser(input.id, signal)
      },
      async mutateModrinth(input, signal) {
        const deleting = input.kind === 'unfollow' || input.kind === 'collection-remove' || input.kind === 'collection-delete'
        const detail = 'collection' in input ? input.collection : 'project' in input ? input.project : input.name
        await confirmAgentActionForRun(context, {
          title: 'Modify Modrinth account',
          message: `Allow the agent to run ${input.kind}?`,
          details: [detail],
          confirmLabel: deleting ? 'Remove' : 'Confirm',
          destructive: deleting,
        }, signal)
        if (input.kind === 'follow') await modrinthAuthenticatedAPI.followProject(input.project)
        else if (input.kind === 'unfollow') await modrinthAuthenticatedAPI.unfollowProject(input.project)
        else if (input.kind === 'collection-create') await modrinthAuthenticatedAPI.createCollection(input.name, input.description, input.projects)
        else if (input.kind === 'collection-add') await modrinthAuthenticatedAPI.addToCollection(input.collection, input.project)
        else if (input.kind === 'collection-remove') await modrinthAuthenticatedAPI.removeFromCollection(input.collection, input.project)
        else if (input.kind === 'collection-delete') await modrinthAuthenticatedAPI.deleteCollection(input.collection)
        return { ok: true, action: input.kind }
      },
      async getModrinthCategories(input, signal) {
        const categories = await clientModrinthV2.getCategoryTags(signal)
        return {
          source: 'modrinth',
          type: input.type,
          categories: categories
            .filter(category => !input.type || category.project_type === input.type)
            .map(category => ({
              id: category.name,
              name: category.name,
              type: category.project_type,
              group: category.header,
            })),
        }
      },
      async searchModrinth(input, signal) {
        const instance = currentInstance(context)
        const facets: string[][] = [[`project_type:${input.type}`]]
        const resolvedFilters = resolveAgentMarketFilters(instance.runtime, input)
        const gameVersion = resolvedFilters.gameVersion
        const loader = input.loader ?? (input.type === 'mod' || input.type === 'modpack' ? resolvedFilters.loader : undefined)
        if (gameVersion) facets.push([`versions:${gameVersion}`])
        if (loader) facets.push([`categories:${loader}`])
        if (input.categories.length) facets.push(input.categories.map(category => `categories:${category}`))
        if (input.license) facets.push([`license:${input.license}`])
        if (input.environment === 'client') {
          facets.push(['client_side:optional', 'client_side:required'], ['server_side:optional', 'server_side:unsupported'])
        } else if (input.environment === 'server') {
          facets.push(['client_side:optional', 'client_side:unsupported'], ['server_side:optional', 'server_side:required'])
        }
        const result = await clientModrinthV2.searchProjects({
          query: input.query,
          facets: JSON.stringify(facets),
          index: input.index,
          limit: input.limit,
          offset: (input.page - 1) * input.limit,
        }, signal)
        const totalPages = Math.ceil(result.total_hits / input.limit)
        const projects = result.hits.map(withModrinthSearchInstallRef)
        return {
          filters: input.all ? { all: true } : { gameVersion, loader },
          total: result.total_hits,
          page: input.page,
          pageSize: input.limit,
          totalPages,
          hasNextPage: input.page < totalPages,
          projects,
          presentation: {
            type: 'market-project-list',
            source: 'modrinth',
            query: input.query,
            total: result.total_hits,
            page: input.page,
            pageSize: input.limit,
            totalPages,
            items: projects.map(project => ({
              provider: 'modrinth',
              projectType: project.project_type,
              id: project.project_id,
              title: project.title,
              description: project.description,
              icon: project.icon_url,
              author: project.author,
              downloads: project.downloads,
              installRef: project.installRef,
            })),
          },
        }
      },
      async getModrinthVersions(input, signal) {
        const instance = currentInstance(context)
        const { gameVersion, loader } = resolveAgentMarketFilters(instance.runtime, input)
        const versions = await clientModrinthV2.getProjectVersions(input.project, {
          gameVersions: gameVersion ? [gameVersion] : undefined,
          loaders: loader ? [loader] : undefined,
          featured: input.featured,
        }, signal)
        const offset = (input.page - 1) * input.limit
        const totalPages = Math.ceil(versions.length / input.limit)
        return {
          project: input.project,
          filters: input.all ? { all: true } : { gameVersion, loader },
          total: versions.length,
          page: input.page,
          pageSize: input.limit,
          totalPages,
          hasNextPage: input.page < totalPages,
          versions: versions.slice(offset, offset + input.limit).map(version => ({
            id: version.id,
            name: version.name,
            versionNumber: version.version_number,
            gameVersions: version.game_versions,
            loaders: version.loaders,
            installRef: `modrinth:${input.project}@${version.id}`,
          })),
        }
      },
      async getCurseforgeCategories(input, signal) {
        const categories = await clientCurseforgeV1.getCategories(signal)
        return {
          source: 'curseforge',
          classId: input.classId,
          categories: categories
            .filter(category => input.classId === undefined || category.parentCategoryId === input.classId)
            .sort((left, right) => (left.displayIndex ?? 0) - (right.displayIndex ?? 0))
            .map(category => ({
              id: category.id,
              name: category.name,
              slug: category.slug,
              isClass: category.isClass,
              classId: category.classId,
              parentCategoryId: category.parentCategoryId,
            })),
        }
      },
      async queryCurseforge(input, signal) {
        if (input.kind === 'projects') {
          return input.ids.length === 1
            ? clientCurseforgeV1.getMod(input.ids[0], signal)
            : clientCurseforgeV1.getMods(input.ids, signal)
        }
        if (input.kind === 'file') return decorateCurseforgeFiles(await clientCurseforgeV1.getModFile(input.project, input.file, signal))
        if (input.kind === 'files') return decorateCurseforgeFiles(await clientCurseforgeV1.getFiles(input.ids, signal))
        if (input.kind === 'description') return clientCurseforgeV1.getModDescription(input.project, signal)
        if (input.kind === 'changelog') return clientCurseforgeV1.getModFileChangelog(input.project, input.file, signal)
        return input.fuzzy
          ? clientCurseforgeV1.getFingerprintsFuzzyMatchesByGameId(432, input.fingerprints, signal)
          : clientCurseforgeV1.getFingerprintsMatchesByGameId(432, input.fingerprints, signal)
      },
      async searchCurseforge(input, signal) {
        const instance = currentInstance(context)
        const filters = resolveAgentMarketFilters(instance.runtime, { gameVersion: input.gameVersion, loader: input.loaders[0], all: input.all })
        const gameVersion = filters.gameVersion
        const loaders = input.all ? [] : input.loaders.length ? input.loaders : filters.loader ? [curseforgeLoaderName(filters.loader as AgentLoader)] : []
        const result = await clientCurseforgeV1.searchMods({
          searchFilter: input.query || undefined,
          classId: input.classId ?? CurseforgeBuiltinClassId.mod,
          categoryId: input.category,
          slug: input.slug,
          gameVersion,
          modLoaderTypes: loaders,
          gameVersionTypeId: input.gameVersionType,
          sortField: input.sort as ModsSearchSortField | undefined,
          sortOrder: input.order,
          index: (input.page - 1) * input.limit,
          pageSize: input.limit,
        }, signal)
        const totalPages = Math.ceil(result.pagination.totalCount / input.limit)
        return {
          filters: input.all ? { all: true } : { gameVersion, loaders },
          total: result.pagination.totalCount,
          page: input.page,
          pageSize: input.limit,
          totalPages,
          hasNextPage: input.page < totalPages,
          projects: result.data,
          presentation: {
            type: 'market-project-list',
            source: 'curseforge',
            query: input.query,
            total: result.pagination.totalCount,
            page: input.page,
            pageSize: input.limit,
            totalPages,
            items: result.data.map(project => ({
              provider: 'curseforge',
              projectType: 'mod',
              id: String(project.id),
              title: project.name,
              description: project.summary,
              icon: project.logo?.thumbnailUrl || project.logo?.url,
              author: project.authors?.map(author => author.name).join(', '),
              downloads: project.downloadCount,
            })),
          },
        }
      },
      async getCurseforgeFiles(input, signal) {
        const instance = currentInstance(context)
        const { gameVersion, loader } = resolveAgentMarketFilters(instance.runtime, input)
        const result = await clientCurseforgeV1.getModFiles({
          modId: input.project,
          gameVersion,
          modLoaderType: curseforgeLoaderType(loader),
          gameVersionTypeId: input.gameVersionType,
          index: (input.page - 1) * input.limit,
          pageSize: input.limit,
        }, signal)
        const totalPages = Math.ceil(result.pagination.totalCount / input.limit)
        return {
          project: input.project,
          filters: input.all ? { all: true } : { gameVersion, loader },
          total: result.pagination.totalCount,
          page: input.page,
          pageSize: input.limit,
          totalPages,
          hasNextPage: input.page < totalPages,
          files: result.data.map(file => ({
            id: file.id,
            name: file.displayName,
            filename: file.fileName,
            gameVersions: file.gameVersions,
            installRef: `curseforge:${input.project}/${file.id}`,
          })),
        }
      },
      async listLoaderMetadata(input) {
        const loader = input.loader
        const minecraft = input.minecraft ?? currentInstance(context).runtime.minecraft
        const result = await loaderVersions(loader, minecraft, input.refresh)
        const rawVersions = Array.isArray(result) ? result : result.loaderVersions
        const versions = loader === 'neoforge'
          ? sortNeoForgeVersions(rawVersions as string[])
          : rawVersions
        return { loader, minecraft, versions: versions.slice(0, input.limit) }
      },
      async listMinecraftMetadata(input) {
        const result = await metadata.getMinecraftVersions(input.refresh)
        const matching = input.type
          ? result.versions.filter(version => version.type === input.type)
          : result.versions
        return {
          latest: result.latest,
          type: input.type ?? 'all',
          count: Math.min(matching.length, input.limit),
          total: matching.length,
          versions: matching.slice(0, input.limit).map(version => ({
            id: version.id,
            type: version.type,
            releaseTime: version.releaseTime,
          })),
        }
      },
      async listLocalVersions(input) {
        if (input.refresh) await versionService.refreshVersions(true)
        const versions = await versionService.getLocalVersions()
        const entries = input.server ? versions.servers : versions.local
        return { kind: input.server ? 'server' : 'client', count: entries.length, versions: entries }
      },
      async getLocalVersion(input) {
        const versions = await versionService.getLocalVersions()
        if (input.server) {
          const header = versions.servers.find(version => version.id === input.id)
          if (!header) throw new Error(`Local server version not found: ${input.id}`)
          const resolved = await versionService.resolveServerVersion(input.id)
          return {
            ...header,
            resolved: {
              id: resolved.id,
              minecraftVersion: resolved.minecraftVersion,
              mainClass: resolved.mainClass,
              jar: resolved.jar,
              libraries: resolved.libraries.length,
            },
          }
        }
        const header = versions.local.find(version => version.id === input.id)
        if (!header) throw new Error(`Local client version not found: ${input.id}`)
        const resolved = await versionService.resolveLocalVersion(input.id)
        return {
          ...header,
          resolved: {
            id: resolved.id,
            minecraftVersion: resolved.minecraftVersion,
            type: resolved.type,
            inheritances: resolved.inheritances,
            mainClass: resolved.mainClass,
            javaVersion: resolved.javaVersion,
            libraries: resolved.libraries.length,
          },
        }
      },
      async refreshLocalVersions(input) {
        if (!input.id) {
          await versionService.refreshVersions(true)
        } else if (input.server) {
          await versionService.refreshServerVersion(input.id)
        } else {
          await versionService.refreshVersion(input.id)
        }
        const versions = await versionService.getLocalVersions()
        const entries = input.server ? versions.servers : versions.local
        return { ok: true, kind: input.server ? 'server' : 'client', refreshed: input.id ?? 'all', count: entries.length }
      },
      async deleteLocalVersion(input, signal) {
        const versions = await versionService.getLocalVersions()
        if (!versions.local.some(version => version.id === input.id)) throw new Error(`Local client version not found: ${input.id}`)
        await confirmAgentActionForRun(context, {
          title: 'Delete local version',
          message: `Delete local Minecraft version ${input.id}?`,
          details: [input.id],
          confirmLabel: 'Delete',
          destructive: true,
        }, signal)
        await versionService.deleteVersion(input.id)
        return { ok: true, deleted: input.id }
      },
      async openLocalVersion(input) {
        const opened = input.id
          ? await versionService.showVersionDirectory(input.id)
          : await versionService.showVersionsDirectory()
        return { ok: opened, version: input.id ?? null }
      },
      async getInstanceRuntime() {
        const instance = currentInstance(context)
        return { instance: instance.path, name: instance.name, runtime: instance.runtime, resolvedVersion: instance.version || null }
      },
      async setInstanceRuntime(input) {
        const instance = currentInstance(context)
        const runtime: Partial<PartialRuntimeVersions> = {}
        if (input.minecraft) runtime.minecraft = input.minecraft
        if (input.loader || input.noLoader) {
          runtime.forge = ''
          runtime.neoForged = ''
          runtime.fabricLoader = ''
          runtime.quiltLoader = ''
          runtime.optifine = ''
          runtime.labyMod = ''
        }
        if (input.loader === 'forge') runtime.forge = input.loaderVersion
        else if (input.loader === 'neoforge') runtime.neoForged = input.loaderVersion
        else if (input.loader === 'fabric') runtime.fabricLoader = input.loaderVersion
        else if (input.loader === 'quilt') runtime.quiltLoader = input.loaderVersion
        const nextRuntime: PartialRuntimeVersions = { ...instance.runtime, ...runtime }
        const runtimeChanged = isAgentRuntimeCompatibilityChanged(instance.runtime, nextRuntime)
        await instanceService.editInstance({ instancePath: context.scope, runtime: nextRuntime, version: '' })
        runtimeChange.pending ||= runtimeChanged
        return {
          ok: true,
          edited: ['runtime'],
          runtime: nextRuntime,
          installPending: true,
          note: 'Run `instance install` to install and resolve this runtime.',
        }
      },
      async installInstance() {
        const instance = currentInstance(context)
        await confirmInstall(context, 'Install instance', 'Diagnose and install the selected instance runtime?', instance.name)
        const result = await capabilities.context.installInstance()
        if (result && typeof result === 'object' && 'error' in result) throw new Error(String(result.error))
        if (!runtimeChange.pending) return result
        runtimeChange.pending = false
        return { ...result as object, ...await diagnoseRuntimeMods() }
      },
      async getInstanceManifest() {
        const manifest = await instanceInstall.getInstanceInstallManifest(context.scope)
        return manifest ?? { pending: false, oldFiles: [], files: [] }
      },
      async applyInstanceManifest() {
        const manifest = await instanceInstall.getInstanceInstallManifest(context.scope)
        if (!manifest) return { ok: true, applied: 0, note: 'No pending instance manifest.' }
        const modPath = (path: string) => {
          const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '')
          return normalized.startsWith('mods/') || normalized.includes('/mods/')
        }
        const addedMods = manifest.files.map(file => file.path).filter(modPath)
        const removedMods = manifest.oldFiles.map(file => file.path).filter(modPath)
        const presentations: AgentMarketProjectListPresentation[] = []
        const modrinthIds = [...new Set(manifest.files.flatMap(file => file.modrinth?.projectId ? [file.modrinth.projectId] : []))]
        const curseforgeIds = [...new Set(manifest.files.flatMap(file => file.curseforge?.projectId ? [file.curseforge.projectId] : []))]
        const projectType = (path: string) => path.replace(/\\/g, '/').startsWith('resourcepacks/')
          ? 'resourcepack' as const
          : path.replace(/\\/g, '/').startsWith('shaderpacks/')
            ? 'shader' as const
            : 'mod' as const
        const modrinthPaths = new Map(manifest.files.flatMap(file => file.modrinth?.projectId ? [[file.modrinth.projectId, file.path] as const] : []))
        const curseforgePaths = new Map(manifest.files.flatMap(file => file.curseforge?.projectId ? [[file.curseforge.projectId, file.path] as const] : []))
        if (modrinthIds.length) {
          try {
            const projects = await clientModrinthV2.getProjects(modrinthIds)
            presentations.push({
              type: 'market-project-list',
              source: 'modrinth',
              query: '',
              total: projects.length,
              items: projects.map(project => ({
                provider: 'modrinth',
                projectType: projectType(modrinthPaths.get(project.id) ?? ''),
                id: project.id,
                title: project.title,
                description: project.description,
                icon: project.icon_url,
                downloads: project.downloads,
              })),
            })
          } catch {
          }
        }
        if (curseforgeIds.length) {
          try {
            const projects = await clientCurseforgeV1.getMods(curseforgeIds)
            presentations.push({
              type: 'market-project-list',
              source: 'curseforge',
              query: '',
              total: projects.length,
              items: projects.map(project => ({
                provider: 'curseforge',
                projectType: projectType(curseforgePaths.get(project.id) ?? ''),
                id: String(project.id),
                title: project.name,
                description: project.summary,
                icon: project.logo?.thumbnailUrl || project.logo?.url,
                author: project.authors?.map(author => author.name).join(', '),
                downloads: project.downloadCount,
              })),
            })
          } catch {
          }
        }
        await confirmAgentActionForRun(context, {
          title: 'Apply instance manifest',
          message: `Apply ${manifest.files.length} addition${manifest.files.length === 1 ? '' : 's'} and ${manifest.oldFiles.length} removal${manifest.oldFiles.length === 1 ? '' : 's'}?`,
          details: [
            currentInstance(context).name,
            ...manifest.files.map(file => `+ ${file.path}`),
            ...manifest.oldFiles.map(file => `- ${file.path}`),
          ],
          presentations,
          confirmLabel: 'Apply',
          allowAll: true,
        })
        await instanceInstall.applyInstanceInstallManifest(context.scope)
        let modDiagnosis: unknown
        if (addedMods.length || removedMods.length) {
          try {
            modDiagnosis = await capabilities.context.diagnoseModCompatibility({ added: addedMods, removed: removedMods })
          } catch (error) {
            modDiagnosis = { status: 'error', error: error instanceof Error ? error.message : String(error) }
          }
        }
        return createAgentManifestApplyResult(
          manifest.files.map(file => file.path),
          manifest.oldFiles.map(file => file.path),
          modDiagnosis as any,
        )
      },
      async discardInstanceManifest() {
        const manifest = await instanceInstall.getInstanceInstallManifest(context.scope)
        if (!manifest) return { ok: true, discarded: 0, note: 'No pending instance manifest.' }
        await confirmAgentActionForRun(context, {
          title: 'Discard instance manifest',
          message: 'Discard all staged instance file changes?',
          details: [currentInstance(context).name],
          confirmLabel: 'Discard',
          destructive: true,
        })
        await instanceInstall.discardInstanceInstallManifest(context.scope)
        return { ok: true, discarded: manifest.files.length + manifest.oldFiles.length }
      },
      async getServerStatus() {
        return capabilities.context.getServerStatus()
      },
      async installServer() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Install server',
          message: 'Install the dedicated server build?',
          details: [instance.name],
          confirmLabel: 'Install',
        })
        return capabilities.context.installServer()
      },
      async deployServerMods(input) {
        const paths = input.compatible
          ? undefined
          : input.paths.map((path) => {
            const name = path.replace(/^\.?\/+/, '').replace(/^mods\//, '')
            const mod = capabilities.context.mods.value.find(value => value.path === path || value.fileName === name || value.modId === name)
            return mod?.path ?? path
          })
        await confirmAgentActionForRun(context, {
          title: 'Deploy server mods',
          message: 'Deploy mods into the local server folder?',
          details: paths ?? ['All server-compatible enabled mods'],
          confirmLabel: 'Deploy',
        })
        return capabilities.context.deployServerMods(paths)
      },
      async startServer(input) {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Start server',
          message: 'Launch the local dedicated server?',
          details: [instance.name],
          confirmLabel: 'Start',
        })
        return capabilities.context.launchServer({ nogui: input.nogui })
      },
      async stopServer(input) {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Stop server',
          message: 'Stop the running local server?',
          details: [instance.name],
          confirmLabel: 'Stop',
          destructive: true,
        })
        await capabilities.context.killGame('server', input.force)
        return { ok: true }
      },
      async getRemoteServerStatus() {
        return capabilities.context.getRemoteServerStatus()
      },
      async testRemoteServerConnection() {
        return capabilities.context.testRemoteServerConnection()
      },
      async installRemoteServerService() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Install remote service',
          message: 'Install the systemd service on the remote host?',
          details: [instance.name],
          confirmLabel: 'Continue',
        })
        return capabilities.context.installRemoteServerService()
      },
      async uninstallRemoteServerService() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Uninstall remote service',
          message: 'Remove the systemd service from the remote host?',
          details: [instance.name],
          confirmLabel: 'Stop',
          destructive: true,
        })
        return capabilities.context.uninstallRemoteServerService()
      },
      async startRemoteServer() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Start remote server',
          message: 'Start the remote server?',
          details: [instance.name],
          confirmLabel: 'Continue',
        })
        return capabilities.context.startRemoteServer()
      },
      async stopRemoteServer() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Stop remote server',
          message: 'Stop the running remote server?',
          details: [instance.name],
          confirmLabel: 'Stop',
          destructive: true,
        })
        return capabilities.context.stopRemoteServer()
      },
      async restartRemoteServer() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Restart remote server',
          message: 'Restart the remote server?',
          details: [instance.name],
          confirmLabel: 'Stop',
          destructive: true,
        })
        return capabilities.context.restartRemoteServer()
      },
      async listAccounts() {
        const active = capabilities.context.userProfile.value?.id
        return capabilities.context.accounts.value.map(account => ({
          id: account.id,
          username: account.username,
          authority: account.authority,
          profile: account.profiles?.[account.selectedProfile]?.name,
          expired: account.invalidated || account.expiredAt < Date.now(),
          active: account.id === active,
        }))
      },
      async selectAccount(input) {
        const account = capabilities.context.accounts.value.find(value =>
          value.id === input.ref ||
          value.username === input.ref ||
          value.profiles?.[value.selectedProfile]?.name === input.ref)
        if (!account) throw new Error(`Account not found: ${input.ref}`)
        capabilities.context.selectAccount(account.id)
        return { ok: true, id: account.id, username: account.username }
      },
      async diagnoseJava() {
        const status = capabilities.context.javaStatus.value
        if (!status) return { available: false, note: 'Java status is not available yet.' }
        const selected = status.java
        return {
          available: true,
          issue: capabilities.context.javaIssue.value ?? 'none',
          noJavaFound: !!status.noJava,
          requiredMajorVersion: status.javaVersion?.majorVersion,
          compatibility: compatibilityLabel(status.compatible),
          selectedJava: selected
            ? { path: selected.path, version: selected.version, majorVersion: selected.majorVersion, valid: selected.valid }
            : null,
          installedJavas: capabilities.context.javaList.value.map(java => ({
            path: java.path,
            version: java.version,
            majorVersion: java.majorVersion,
            valid: java.valid,
          })),
        }
      },
      async listJava(input) {
        if (input.refresh) await capabilities.context.refreshJavaList(true)
        return capabilities.context.javaList.value.map(java => ({
          path: java.path,
          version: java.version,
          majorVersion: java.majorVersion,
          arch: java.arch,
          valid: java.valid,
          selected: java.path === currentInstance(context).java,
        }))
      },
      async selectJava(input) {
        const instance = currentInstance(context)
        if (!input.path) {
          await instanceService.editInstance({ instancePath: instance.path, java: '' })
          return { ok: true, mode: 'auto' }
        }
        const java = capabilities.context.javaList.value.find(value => value.path === input.path)
        if (!java) throw new Error(`Java path is not in the launcher local Java list: ${input.path}`)
        if (!java.valid) throw new Error(`Java path is invalid: ${input.path}`)
        await instanceService.editInstance({ instancePath: instance.path, java: java.path })
        return {
          ok: true,
          mode: 'manual',
          path: java.path,
          version: java.version,
          majorVersion: java.majorVersion,
          arch: java.arch,
        }
      },
      async installJava(input) {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Install Java',
          message: 'Install a compatible Java runtime for the selected instance?',
          details: [
            instance.name,
            input.forceZulu ? 'Zulu runtime' : 'Official runtime preferred; Zulu fallback allowed',
          ],
          confirmLabel: 'Continue',
        })
        return capabilities.context.installJava(input.forceZulu)
      },
      async checkModDependencies() {
        return capabilities.context.checkModDependencies()
      },
      async installModDependencies() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Install mod dependencies',
          message: 'Install the missing required mod dependencies?',
          details: [instance.name],
          confirmLabel: 'Continue',
        })
        return capabilities.context.installModDependencies()
      },
      async scanUnusedMods() {
        return capabilities.context.scanUnusedMods()
      },
      async checkModUpdates(input) {
        return capabilities.context.checkModUpdates(input)
      },
      async stageModUpdates() {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Stage mod updates',
          message: 'Add the available compatible mod updates to the instance manifest?',
          details: [instance.name],
          confirmLabel: 'Continue',
        })
        return capabilities.context.stageModUpdates()
      },
      async importWorld(input) {
        const instance = currentInstance(context)
        await confirmAgentActionForRun(context, {
          title: 'Import world',
          message: 'Import this world into the selected instance?',
          details: [input.path],
          confirmLabel: 'Continue',
        })
        const importedPath = await savesService.importSave({
          instancePath: instance.path,
          path: input.path,
          saveName: input.name,
        })
        return { ok: true, importedPath }
      },
      async exportWorld(input) {
        const instance = currentInstance(context)
        const save = capabilities.context.saves.value.find(value => value.name === input.world || value.path === input.world)
        if (!save) throw new Error(`World not found: ${input.world}`)
        await savesService.exportSave({
          instancePath: instance.path,
          saveName: save.name,
          destination: input.destination,
          zip: input.zip,
        })
        return { ok: true, world: save.name, destination: input.destination, zip: input.zip }
      },
      async cloneWorld(input) {
        const instance = currentInstance(context)
        const save = capabilities.context.saves.value.find(value => value.name === input.world || value.path === input.world)
        if (!save) throw new Error(`World not found: ${input.world}`)
        const destination = input.destination
          ? instances.allInstances.value.find(value => value.path === input.destination || value.name === input.destination)?.path
          : instance.path
        if (!destination) throw new Error(`Instance not found: ${input.destination}`)
        await savesService.cloneSave({
          srcInstancePath: instance.path,
          destInstancePath: destination,
          saveName: save.name,
          newSaveName: input.name,
        })
        return { ok: true, world: save.name, name: input.name, destination }
      },
      async linkWorldAsServer(input) {
        const instance = currentInstance(context)
        const save = capabilities.context.saves.value.find(value => value.name === input.world || value.path === input.world)
        if (!save) throw new Error(`World not found: ${input.world}`)
        await savesService.linkSaveAsServerWorld({ instancePath: instance.path, saveName: save.name })
        return { ok: true, linked: save.name }
      },
      async listInstances() {
        return instances.allInstances.value.map(instance => ({
          path: instance.path,
          name: instance.name,
          description: instance.description,
          runtime: instance.runtime,
          selected: instance.path === context.scope,
        }))
      },
      async createInstance(input) {
        const path = await instanceService.createInstance({
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          ...(input.runtime ? { runtime: input.runtime as PartialRuntimeVersions } : {}),
        })
        return { ok: true, path, selected: false }
      },
      async diagnoseInstance() {
        return summarizeInstallInstruction(capabilities.context.installInstruction.value)
      },
      async repairInstance() {
        const instance = currentInstance(context)
        await confirmInstall(context, 'Repair instance', 'Install missing files for the selected instance?', instance.name)
        const before = summarizeInstallInstruction(capabilities.context.installInstruction.value)
        await capabilities.context.fixInstanceInstall()
        return { ok: true, before, after: summarizeInstallInstruction(capabilities.context.installInstruction.value) }
      },
      async duplicateInstance(input) {
        const source = input.source
          ? instances.allInstances.value.find(value => value.path === input.source || value.name === input.source)?.path
          : context.scope
        if (!source) throw new Error(`Instance not found: ${input.source}`)
        await confirmAgentActionForRun(context, {
          title: 'Duplicate instance',
          message: 'Duplicate this instance and its content?',
          details: [source],
          confirmLabel: 'Continue',
        })
        const path = await instanceService.duplicateInstance(source)
        return { ok: true, path, from: source, selected: false }
      },
      async deleteInstance(input) {
        const target = input.target
          ? instances.allInstances.value.find(value => value.path === input.target || value.name === input.target)?.path
          : context.scope
        if (!target) throw new Error(`Instance not found: ${input.target}`)
        await confirmAgentActionForRun(context, {
          title: 'Delete instance',
          message: 'Delete this instance permanently?',
          details: [target],
          confirmLabel: 'Delete',
          destructive: true,
        })
        await instanceService.deleteInstance(target, input.deleteData)
        return { ok: true, deleted: target, deletedData: input.deleteData }
      },
      async importModpack(input) {
        await confirmAgentActionForRun(context, {
          title: 'Import modpack',
          message: 'Import this modpack as a new instance?',
          details: [input.path],
          confirmLabel: 'Continue',
        })
        const result = await capabilities.services.modpackService.importModpack(input.path)
        return {
          ok: true,
          path: result?.instancePath,
          runtime: result?.runtime,
          version: result?.version,
          selected: false,
        }
      },
      async grepConfig(input) {
        if (!input.pattern) throw new Error('pattern must not be empty')
        const requestedPath = String(input.path ?? '')
        if (requestedPath.startsWith('artifacts/')) {
          return agentService.grepArtifact(artifactKey, {
            path: requestedPath,
            pattern: input.pattern,
            ignoreCase: input.ignoreCase,
            offset: input.offset,
            limit: input.limit,
          })
        }
        const expression = new RegExp(input.pattern, input.ignoreCase ? 'i' : '')
        const prefix = requestedPath.replace(/^config\/?/, '')
        const files = (await optionsService.getInstanceConfigFiles(context.scope))
          .filter(file => !prefix || file === prefix || file.startsWith(`${prefix}/`))
        const matches: Array<{ file: string; line: number; text: string }> = []
        const offset = input.offset ?? 0
        const limit = input.limit ?? 200
        let seen = 0
        for (const file of files) {
          const content = await optionsService.getInstanceConfig(context.scope, file).catch(() => '')
          if (content.length > 512 * 1024) continue
          for (const [index, line] of content.split('\n').entries()) {
            expression.lastIndex = 0
            const match = expression.exec(line)
            if (!match) continue
            if (seen >= offset && matches.length < limit) matches.push({ file: `config/${file}`, line: index + 1, text: grepSnippet(line, match.index) })
            seen++
            if (seen > offset + limit) return { matches, offset, limit, hasMore: true }
          }
        }
        return { matches, offset, limit, hasMore: false }
      },
      async moveResource(input) {
        const source = normalizeVfsPath(input.source, context.scope)
        const destination = normalizeVfsPath(input.destination, context.scope)
        const enabling = source.endsWith('.disabled') && destination === source.slice(0, -'.disabled'.length)
        const disabling = !source.endsWith('.disabled') && destination === `${source}.disabled`
        if (!enabling && !disabling) throw new Error('mv only supports adding or removing the .disabled suffix')
        const [kind, ...parts] = source.split('/')
        const name = parts.join('/')
        if (!name || !['mods', 'resourcepacks', 'shaderpacks'].includes(kind)) throw new Error(`Unsupported move path: ${source}`)
        const enabled = enabling
        if (kind === 'mods') {
          const resource = capabilities.context.mods.value.find(value => value.fileName === name || value.path === name || value.path === source)
          if (!resource) throw new Error(`Mod not found: ${name}`)
          const method = enabled ? modsService.enable : modsService.disable
          await method({ path: context.scope, files: [resource.path] })
        } else if (kind === 'resourcepacks') {
          const resource = capabilities.context.resourcePacks.value.find(value => value.fileName === name || value.path === name || value.path === source || value.name === name)
          if (!resource) throw new Error(`Resource pack not found: ${name}`)
          if (enabled) await capabilities.context.enableResourcePack([resource])
          else await capabilities.context.disableResourcePack([resource])
        } else {
          const resource = capabilities.context.shaderPacks.value.find(value => value.fileName === name || value.path === name || value.path === source)
          if (!resource) throw new Error(`Shader pack not found: ${name}`)
          capabilities.context.selectShaderPack(enabled ? resource.fileName : undefined)
        }
        return { ok: true, source, destination, enabled }
      },
      async launchGame() {
        const result = await capabilities.context.launch()
        return { ok: true, ...result }
      },
      async wait(input, signal) {
        const startedAt = Date.now()
        const timeoutMs = input.timeoutSeconds === undefined ? undefined : input.timeoutSeconds * 1_000
        if (signal?.aborted) throw new Error('Wait aborted')
        if (input.gameProcess === undefined) {
          if (timeoutMs === undefined) throw new Error('A timeout is required when no game process is provided')
          await new Promise<void>((resolve, reject) => {
            const cleanup = () => signal?.removeEventListener('abort', abort)
            const timer = setTimeout(() => {
              cleanup()
              resolve()
            }, timeoutMs)
            const abort = () => {
              clearTimeout(timer)
              cleanup()
              reject(new Error('Wait aborted'))
            }
            signal?.addEventListener('abort', abort, { once: true })
          })
          return { ok: true, waitedSeconds: input.timeoutSeconds }
        }

        const pid = input.gameProcess
        let timer: ReturnType<typeof setTimeout> | undefined
        let onAbort: (() => void) | undefined
        let onExit: ((event: { pid: number; code?: number; signal?: string; launchId: string }) => void) | undefined
        const exit = new Promise<Record<string, unknown>>((resolve) => {
          onExit = (event) => {
            if (event.pid !== pid) return
            resolve({
              ok: true,
              gameProcess: pid,
              launchId: event.launchId,
              exited: true,
              code: event.code,
              signal: event.signal,
              elapsedMs: Date.now() - startedAt,
            })
          }
          launchService.on('minecraft-exit', onExit)
        })
        try {
          const process = await launchService.getGameProcess(pid)
          if (process?.options.gameDirectory !== context.scope) {
            return { ok: true, gameProcess: pid, exited: true, found: false, elapsedMs: Date.now() - startedAt }
          }
          const waits: Promise<Record<string, unknown>>[] = [exit]
          if (timeoutMs !== undefined) {
            waits.push(new Promise(resolve => {
              timer = setTimeout(() => resolve({
                ok: true,
                gameProcess: pid,
                launchId: process.launchId,
                exited: false,
                timedOut: true,
                elapsedMs: Date.now() - startedAt,
              }), timeoutMs)
            }))
          }
          if (signal) {
            waits.push(new Promise((_, reject) => {
              onAbort = () => reject(new Error('Wait aborted'))
              signal.addEventListener('abort', onAbort, { once: true })
            }))
          }
          return await Promise.race(waits)
        } finally {
          if (timer) clearTimeout(timer)
          if (onExit) launchService.removeListener('minecraft-exit', onExit)
          if (onAbort) signal?.removeEventListener('abort', onAbort)
        }
      },
      async stopGame(input) {
        await confirmInstall(context, 'Stop game', 'Stop the running Minecraft client?', currentInstance(context).name, true)
        await capabilities.context.killGame('client', input.force)
        return { ok: true }
      },
      async navigateUi(input, signal) {
        return uiHandler({ action: 'navigate', path: input.path }, signal)
      },
    }
  }

  async function createVfsShellTool(context: AgentRunContext, vfs: Awaited<ReturnType<typeof createVfsTools>>, runtimeChange: AgentRuntimeChangeTracker): Promise<AgentTool> {
    const runtimeCommands = createAgentRuntimeCommands(createCommandOperations(context, vfs, runtimeChange))
    const runtimeByName = createAgentRuntimeCommandIndex(runtimeCommands)
    const presentStagedInstall = createAgentStagedInstallPresenter()
    const allowedCommands = () => commandHost.registry.list({ mode: 'cli' })
      .filter(command => isAgentCommandAllowed(command.id))
      .map(command => ({ command, name: command.cli?.name ?? command.id.replace(/\./g, ' ') }))
    const rootHelp = () => {
      const runtimeHelp = runtimeCommands.map(command => {
        const aliases = command.aliases?.length ? ` (${command.aliases.join(', ')})` : ''
        return `  ${(command.name + aliases).padEnd(28)} ${command.description}`
      }).join('\n')
      const commandHelp = allowedCommands()
        .map(({ command, name }) => `  ${name.padEnd(28)} ${command.title}`)
        .join('\n')
      return `Allowed XMCL commands:\n${commandHelp}\n\nAgent renderer commands:\n${runtimeHelp}\n\nRun \`help <command>\` for exact syntax.`
    }
    const commandHelp = (name: string) => {
      const runtime = runtimeByName.get(name)
      if (runtime) return formatAgentRuntimeCommandHelp(runtime)
      const command = allowedCommands().find(value => value.name === name)?.command
      if (!command) throw new Error(`Unknown command: ${name}`)
      return formatCommandHelp(command, { programName: 'vfs_shell' })
    }
    return {
      name: 'vfs_shell',
      label: 'XMCL command',
      description: 'Run one virtual XMCL command. This is not an OS shell and cannot inspect source code, repositories, or arbitrary host files; use `help` to discover supported commands.',
      parameters: Type.Object({ command: Type.String() }),
      executionMode: 'sequential',
      async execute(_id, args: any, signal) {
        let argv = tokenize(args.command)
        if (argv[0] === 'vfs_shell') argv = argv.slice(1)
        assertAgentCommandSyntax(argv)
        if (!argv.length || (argv[0] === 'help' && argv.length === 1)) return textResult(rootHelp())
        if (argv[0] === 'help') return textResult(commandHelp(argv.slice(1).join(' ')))
        const runtime = runtimeByName.get(argv[0])
        if (runtime) {
          const runtimeArgv = argv.slice(1)
          return textResult(await executeAgentRuntimeCommand(runtime, runtimeArgv, signal))
        }
        const candidates = allowedCommands()
          .sort((a, b) => b.name.length - a.name.length)
        const match = candidates.find(candidate => args.command === candidate.name || args.command.startsWith(`${candidate.name} `))
        if (!match) throw new Error('Unsupported command. Run `help` to list commands.')
        const parsed = parseCli([match.name, ...tokenize(args.command.slice(match.name.length).trim())], commandHost.registry)
        if (parsed.kind === 'error') throw new Error(parsed.message)
        if (parsed.kind !== 'command') return textResult(commandHelp(match.name))
        parsed.input.instance = context.scope
        const result = parsed.commandId === 'mod.install'
          ? await stageModWithDependencies(parsed.input, context)
          : await commandHost.dispatch(parsed.commandId, parsed.input)
        return textResult(presentStagedInstall(parsed.commandId, result, context.scope))
      },
    }
  }

  async function createLauncherTools(context: AgentRunContext) {
    const runtimeChange = { pending: false }
    const vfs = await createVfsTools(context, runtimeChange)
    return [
      ...vfs.tools,
      await createVfsShellTool(context, vfs, runtimeChange),
    ]
  }

  return { createLauncherTools }
}

export function useCssAgentToolFactory() {
  const themeService = useService(ThemeServiceKey)
  const instances = injection(kInstances)
  const user = injection(kUserContext)
  const router = useRouter()
  const uiHandler = createAgentUiHandler({
    router,
    selectedInstance: instances.selectedInstance,
    instances: instances.allInstances,
    selectAccount: user.select,
    confirm: requestAgentConfirmation,
  })

  const uiTool: AgentTool = {
    name: 'ui',
    label: 'Launcher UI',
    description: 'Inspect the XMCL user interface for CSS selectors and computed styles.',
    parameters: actionObjectSchema(
      ['query_dom', 'get_computed_style', 'get_dom_outline'],
      {
        selector: {
          type: 'string',
          description: 'CSS selector. Required for query_dom and get_computed_style; optional for get_dom_outline.',
        },
        limit: { type: 'number', description: 'Max elements for query_dom (1-50).' },
        properties: {
          type: 'array',
          items: { type: 'string' },
          description: 'CSS properties for get_computed_style.',
        },
        maxDepth: { type: 'number', description: 'Tree depth for get_dom_outline (1-8).' },
      },
      'Which UI inspection to run.',
    ),
    executionMode: 'parallel',
    async execute(_id, input, signal) {
      return textResult(await uiHandler(input as any, signal))
    },
  }

  async function createCssTools() {
    return [
      {
        name: 'get_custom_css',
        label: 'Read custom CSS',
        description: 'Read the current global custom CSS and enabled state.',
        parameters: Type.Object({}),
        executionMode: 'parallel',
        async execute() {
          const [css, theme] = await Promise.all([themeService.getCustomCss(), themeService.getCurrentTheme()])
          return textResult({ css, enabled: !!theme?.settings?.customCssEnabled })
        },
      },
      {
        name: 'set_custom_css',
        label: 'Write custom CSS',
        description: 'Replace the complete global custom CSS document.',
        parameters: Type.Object({ css: Type.String() }),
        executionMode: 'sequential',
        async execute(_id: string, args: any) {
          await themeService.setCustomCss(args.css)
          return textResult({ ok: true, length: args.css.length })
        },
      },
      {
        name: 'set_custom_css_enabled',
        label: 'Enable custom CSS',
        description: 'Enable or disable global custom CSS.',
        parameters: Type.Object({ enabled: Type.Boolean() }),
        executionMode: 'sequential',
        async execute(_id: string, args: any) {
          const current = await themeService.getCurrentTheme() ?? { ui: 'keystone', version: 1, assets: {}, settings: {} }
          await themeService.setCurrentTheme({
            ...current,
            settings: { ...current.settings, customCssEnabled: args.enabled },
          })
          return textResult({ ok: true, enabled: args.enabled })
        },
      },
      uiTool,
    ] as AgentTool[]
  }

  return { createCssTools }
}
