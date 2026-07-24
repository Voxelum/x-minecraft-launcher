import type { AgentTool } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'
import { useRendererCommandHost } from '@/composables/commandHost'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { getLatestNeoforge } from '@/composables/version'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import type { EditInstanceOptions } from '@xmcl/instance'
import type { Resource } from '@xmcl/resource'
import {
  formatCommandHelp,
  InstanceLogServiceKey,
  InstanceModsServiceKey,
  InstanceOptionsServiceKey,
  InstanceResourcePacksServiceKey,
  InstanceSavesServiceKey,
  InstanceServiceKey,
  InstanceShaderPacksServiceKey,
  LaunchServiceKey,
  parseCli,
  ThemeServiceKey,
  VersionMetadataServiceKey,
} from '@xmcl/runtime-api'
import { useService } from '../service'
import { requestAgentConfirmation } from './confirm'
import { type AgentCommandOperations, type AgentLoader, assertAgentCommandSyntax, createAgentRuntimeCommands } from './commands'
import type { AgentRunContext } from './local'
import { createAgentUiHandler } from './ui'
import { kInstances } from '../instances'
import { kUserContext } from '../user'
import { useAgentCapabilityContext } from './capabilityContext'
import { createAgentManagementTools } from './managementTools'
import { createAgentServerTools } from './serverTools'
import { textResult } from './toolSupport'
import { buildAgentInstanceEdit, isAgentCommandAllowed } from './toolPolicy'

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

async function confirmInstall(title: string, message: string, detail: string, destructive = false) {
  const accepted = await requestAgentConfirmation({
    action: 'confirm',
    title,
    message,
    details: [detail],
    confirmLabel: destructive ? 'Delete' : 'Install',
    destructive,
  })
  if (!accepted) throw new Error('User declined the action')
}

export function useAgentToolFactory() {
  const modsService = useService(InstanceModsServiceKey)
  const resourcePackService = useService(InstanceResourcePacksServiceKey)
  const shaderPackService = useService(InstanceShaderPacksServiceKey)
  const savesService = useService(InstanceSavesServiceKey)
  const optionsService = useService(InstanceOptionsServiceKey)
  const logService = useService(InstanceLogServiceKey)
  const launchService = useService(LaunchServiceKey)
  const instanceService = useService(InstanceServiceKey)
  const metadata = useService(VersionMetadataServiceKey)
  const versionInstaller = injection(kInstanceVersionInstall)
  const instances = injection(kInstances)
  const user = injection(kUserContext)
  const router = useRouter()
  const commandHost = useRendererCommandHost()
  const capabilities = useAgentCapabilityContext()

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

  async function createVfsTools(context: AgentRunContext): Promise<AgentTool[]> {
    const instancePath = context.scope
    const resources = async (kind: 'mods' | 'resourcepacks' | 'shaderpacks') => {
      const service = kind === 'mods' ? modsService : kind === 'resourcepacks' ? resourcePackService : shaderPackService
      return (await service.watch(instancePath)).files
    }
    const list = async (path: string) => {
      const clean = path.replace(/^\.?\//, '').replace(/\/$/, '')
      if (!clean) {
        return {
          path: instancePath,
          entries: ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'logs', 'crash-reports', 'launch-failures', 'config', 'server', 'game-processes', 'instance.json', 'options.txt'],
        }
      }
      if (clean === 'mods' || clean === 'resourcepacks' || clean === 'shaderpacks') return (await resources(clean)).map(summarizeResource)
      if (clean === 'saves') return (await savesService.watch(instancePath)).saves
      if (clean === 'logs') return logService.listLogs(instancePath)
      if (clean === 'crash-reports') return logService.listCrashReports(instancePath)
      if (clean === 'launch-failures') return logService.listLaunchFailures(instancePath)
      if (clean === 'config') return optionsService.getInstanceConfigFiles(instancePath)
      if (clean === 'server') {
        return ['server.properties', 'eula.txt', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'usercache.json', 'logs']
      }
      if (clean === 'server/logs') return logService.listServerLogs(instancePath)
      if (clean === 'game-processes') return (await launchService.getGameProcesses()).filter(process => process.options.gameDirectory === instancePath)
      throw new Error(`Not a virtual directory: ${path}`)
    }
    const read = async (path: string, tailLines?: number) => {
      const clean = path.replace(/^\.?\//, '')
      if (clean === 'instance.json') return currentInstance(context)
      if (clean === 'options.txt') return optionsService.getGameOptions(instancePath)
      const [kind, ...parts] = clean.split('/')
      const rest = parts.join('/')
      if (kind === 'mods' || kind === 'resourcepacks' || kind === 'shaderpacks') {
        const resource = (await resources(kind)).find(value => value.fileName === rest || value.path === rest || value.name === rest)
        return resource ? summarizeResource(resource) : { error: `${kind} entry not found: ${rest}` }
      }
      if (kind === 'saves') {
        return (await savesService.watch(instancePath)).saves.find(value => value.name === rest || value.path === rest)
          ?? { error: `save not found: ${rest}` }
      }
      if (kind === 'logs' || kind === 'launch-failures') {
        const content = await logService.getLogContent(instancePath, rest)
        return content.split('\n').slice(-Math.min(Math.max(1, tailLines ?? 200), 2000)).join('\n')
      }
      if (kind === 'crash-reports') return logService.getCrashReportContent(instancePath, rest)
      if (kind === 'config') return optionsService.getInstanceConfig(instancePath, rest)
      if (kind === 'server') {
        if (parts[0] === 'logs') {
          const content = await logService.getServerLogContent(instancePath, parts.slice(1).join('/'))
          return content.split('\n').slice(-Math.min(Math.max(1, tailLines ?? 200), 2000)).join('\n')
        }
        return optionsService.getServerFile(instancePath, rest)
      }
      if (kind === 'game-processes') return await launchService.getGameProcess(Number(parts.at(-1))) ?? { error: `game process not found: ${rest}` }
      return { error: `unknown virtual path: ${path}` }
    }

    return [
      {
        name: 'vfs_list',
        label: 'List instance files',
        description: 'List a virtual directory for the explicitly selected instance.',
        parameters: Type.Object({ path: Type.Optional(Type.String()) }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          return textResult(await list(String(args.path ?? '')))
        },
      },
      {
        name: 'vfs_read',
        label: 'Read instance data',
        description: 'Read a virtual instance file or resource entry.',
        parameters: Type.Object({ path: Type.String(), tailLines: Type.Optional(Type.Number()) }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          return textResult(await read(args.path, args.tailLines))
        },
      },
      {
        name: 'vfs_rm',
        label: 'Delete instance files',
        description: 'Delete supported virtual paths after explicit user confirmation.',
        parameters: Type.Object({ paths: Type.Array(Type.String()) }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          await confirmInstall(
            'Delete instance files',
            `Delete ${args.paths.length} path${args.paths.length === 1 ? '' : 's'} from the selected instance?`,
            args.paths.join('\n'),
            true,
          )
          const results: unknown[] = []
          for (const path of args.paths as string[]) {
            const [kind, ...parts] = path.replace(/^\.?\//, '').split('/')
            const rest = parts.join('/')
            if (kind === 'mods' || kind === 'resourcepacks' || kind === 'shaderpacks') {
              const service = kind === 'mods' ? modsService : kind === 'resourcepacks' ? resourcePackService : shaderPackService
              const resource = (await resources(kind)).find(value => value.fileName === rest || value.path === rest || value.name === rest)
              if (!resource) throw new Error(`${kind} entry not found: ${rest}`)
              await service.uninstall({ path: instancePath, files: [resource.path] })
            } else if (kind === 'saves') await savesService.deleteSave({ instancePath, saveName: rest })
            else if (kind === 'logs' || kind === 'launch-failures') await logService.removeLog(instancePath, rest)
            else if (kind === 'crash-reports') await logService.removeCrashReport(instancePath, rest)
            else if (kind === 'config') await optionsService.removeInstanceConfig(instancePath, rest)
            else throw new Error(`Unsupported delete path: ${path}`)
            results.push({ deleted: path })
          }
          return textResult({ ok: true, results })
        },
      },
      {
        name: 'edit_config',
        label: 'Edit instance config',
        description: 'Edit a config file by exact literal replacement.',
        parameters: Type.Object({
          path: Type.String(),
          match_string: Type.String(),
          replace_string: Type.String(),
          all: Type.Optional(Type.Boolean()),
        }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          const clean = args.path.replace(/^config\//, '')
          if (!args.match_string) throw new Error('match_string must not be empty')
          const content = await optionsService.getInstanceConfig(instancePath, clean)
          const index = content.indexOf(args.match_string)
          if (index < 0) throw new Error(`match_string not found in ${args.path}`)
          const next = args.all === false
            ? content.slice(0, index) + args.replace_string + content.slice(index + args.match_string.length)
            : content.split(args.match_string).join(args.replace_string)
          await optionsService.setInstanceConfig(instancePath, clean, next)
          return textResult({ ok: true, path: args.path })
        },
      },
      {
        name: 'edit_instance',
        label: 'Edit instance',
        description: 'Edit allowlisted fields on the selected instance. Runtime changes are merged and reset the resolved version id.',
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
          runtime: Type.Optional(Type.Object({
            minecraft: Type.Optional(Type.String()),
            forge: Type.Optional(Type.String()),
            neoForged: Type.Optional(Type.String()),
            fabricLoader: Type.Optional(Type.String()),
            quiltLoader: Type.Optional(Type.String()),
            optifine: Type.Optional(Type.String()),
            labyMod: Type.Optional(Type.String()),
          })),
          fastLaunch: Type.Optional(Type.Boolean()),
          showLog: Type.Optional(Type.Boolean()),
          hideLauncher: Type.Optional(Type.Boolean()),
          prependCommand: Type.Optional(Type.String()),
          preExecuteCommand: Type.Optional(Type.String()),
        }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          const instance = currentInstance(context)
          const { payload, edited } = buildAgentInstanceEdit(instance, instancePath, args)
          if (!edited.length) throw new Error('No editable fields were provided')
          await instanceService.editInstance(payload as EditInstanceOptions & { instancePath: string })
          return textResult({ ok: true, edited })
        },
      },
      {
        name: 'search_config',
        label: 'Search config',
        description: 'Search config files with a regular expression. Results are capped at 200 matches.',
        parameters: Type.Object({
          pattern: Type.String(),
          path: Type.Optional(Type.String()),
          ignoreCase: Type.Optional(Type.Boolean()),
        }),
        executionMode: 'parallel',
        async execute(_id, args: any) {
          if (!args.pattern) throw new Error('pattern must not be empty')
          const expression = new RegExp(args.pattern, args.ignoreCase ? 'i' : '')
          const prefix = String(args.path ?? '').replace(/^config\/?/, '')
          const files = (await optionsService.getInstanceConfigFiles(instancePath))
            .filter(file => !prefix || file === prefix || file.startsWith(`${prefix}/`))
          const matches: Array<{ file: string; line: number; text: string }> = []
          for (const file of files) {
            const content = await optionsService.getInstanceConfig(instancePath, file).catch(() => '')
            if (content.length > 512 * 1024) continue
            for (const [index, line] of content.split('\n').entries()) {
              expression.lastIndex = 0
              if (expression.test(line)) matches.push({ file: `config/${file}`, line: index + 1, text: line.slice(0, 400) })
              if (matches.length >= 200) return textResult({ matches, truncated: true })
            }
          }
          return textResult({ matches })
        },
      },
      {
        name: 'set_resource_enabled',
        label: 'Enable or disable resource',
        description: 'Enable or disable a mod, resource pack, or shader pack without deleting it.',
        parameters: Type.Object({
          kind: Type.Union([Type.Literal('mod'), Type.Literal('resourcepack'), Type.Literal('shaderpack')]),
          name: Type.String(),
          enabled: Type.Boolean(),
        }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          const name = String(args.name)
          if (args.kind === 'mod') {
            const resource = (await resources('mods')).find(value => value.fileName === name || value.path === name || value.name === name)
            if (!resource) throw new Error(`mod not found: ${name}`)
            const method = args.enabled ? modsService.enable : modsService.disable
            await method({ path: instancePath, files: [resource.path] })
          } else if (args.kind === 'resourcepack') {
            const resource = capabilities.context.resourcePacks.value.find(value => value.fileName === name || value.path === name || value.name === name)
            if (!resource) throw new Error(`resource pack not found: ${name}`)
            if (args.enabled) await capabilities.context.enableResourcePack([resource])
            else await capabilities.context.disableResourcePack([resource])
          } else {
            const resource = capabilities.context.shaderPacks.value.find(value => value.fileName === name || value.path === name)
            if (!resource) throw new Error(`shader pack not found: ${name}`)
            capabilities.context.selectShaderPack(args.enabled ? resource.fileName : undefined)
          }
          return textResult({ ok: true, kind: args.kind, name, enabled: args.enabled })
        },
      },
      {
        name: 'diagnose_instance',
        label: 'Diagnose instance',
        description: 'Diagnose missing or corrupted game files, libraries, assets, loaders, and Java.',
        parameters: Type.Object({}),
        executionMode: 'parallel',
        async execute() {
          return textResult(summarizeInstallInstruction(capabilities.context.installInstruction.value))
        },
      },
      {
        name: 'repair_instance',
        label: 'Repair instance',
        description: 'Install missing or corrupted files required by the selected instance.',
        parameters: Type.Object({}),
        executionMode: 'sequential',
        async execute() {
          await confirmInstall('Repair instance', 'Install missing files for the selected instance?', currentInstance(context).name)
          const before = summarizeInstallInstruction(capabilities.context.installInstruction.value)
          await capabilities.context.fixInstanceInstall()
          return textResult({ ok: true, before, after: summarizeInstallInstruction(capabilities.context.installInstruction.value) })
        },
      },
      {
        name: 'launch_game',
        label: 'Launch game',
        description: 'Launch the selected instance with the active account.',
        parameters: Type.Object({}),
        executionMode: 'sequential',
        async execute() {
          await capabilities.context.launch()
          return textResult({ ok: true })
        },
      },
      {
        name: 'kill_game',
        label: 'Stop game',
        description: 'Stop the running Minecraft client after explicit confirmation.',
        parameters: Type.Object({ force: Type.Optional(Type.Boolean()) }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          await confirmInstall('Stop game', 'Stop the running Minecraft client?', currentInstance(context).name, true)
          await capabilities.context.killGame('client', !!args.force)
          return textResult({ ok: true })
        },
      },
      {
        name: 'list_game_processes',
        label: 'List game processes',
        description: 'List Minecraft processes tracked for the selected instance.',
        parameters: Type.Object({}),
        executionMode: 'parallel',
        async execute() {
          const processes = (await launchService.getGameProcesses())
            .filter(process => process.options.gameDirectory === instancePath)
            .map(process => ({
              pid: process.pid,
              side: process.side,
              ready: process.ready,
              gameDirectory: process.options.gameDirectory,
              version: process.options.version,
            }))
          return textResult(processes)
        },
      },
      {
        name: 'get_shader_options',
        label: 'Read shader options',
        description: 'Read the shader pack configured for the selected instance.',
        parameters: Type.Object({}),
        executionMode: 'parallel',
        async execute() {
          return textResult(await optionsService.getShaderOptions(instancePath))
        },
      },
      {
        name: 'edit_shader_options',
        label: 'Edit shader options',
        description: 'Set the configured shader pack for vanilla, Iris, or Oculus.',
        parameters: Type.Object({
          shaderPack: Type.String(),
          loader: Type.Optional(Type.Union([Type.Literal('vanilla'), Type.Literal('iris'), Type.Literal('oculus')])),
        }),
        executionMode: 'sequential',
        async execute(_id, args: any) {
          const input = { instancePath, shaderPack: args.shaderPack }
          if (args.loader === 'iris') await optionsService.editIrisShaderOptions(input)
          else if (args.loader === 'oculus') await optionsService.editOculusShaderOptions(input)
          else await optionsService.editShaderOptions(input)
          return textResult({ ok: true, loader: args.loader ?? 'vanilla', shaderPack: args.shaderPack })
        },
      },
    ]
  }

  function loaderVersions(loader: AgentLoader, minecraft: string, refresh: boolean) {
    if (loader === 'forge') return metadata.getForgeVersions(minecraft, refresh)
    if (loader === 'neoforge') return metadata.getNeoForgedVersions(minecraft, refresh)
    return loader === 'fabric' ? metadata.getFabricVersions(refresh) : metadata.getQuiltVersions(refresh)
  }

  function createCommandOperations(context: AgentRunContext): AgentCommandOperations {
    return {
      async searchModrinth(input, signal) {
        const instance = currentInstance(context)
        const facets: string[][] = [[`project_type:${input.type ?? 'mod'}`]]
        const gameVersion = input.gameVersion ?? instance.runtime.minecraft
        if (gameVersion) facets.push([`versions:${gameVersion}`])
        if (input.loader) facets.push([`categories:${input.loader}`])
        const result = await clientModrinthV2.searchProjects({
          query: input.query,
          facets: JSON.stringify(facets),
          limit: input.limit,
        }, signal)
        return {
          total: result.total_hits,
          projects: result.hits,
          presentation: {
            type: 'market-project-list',
            source: 'modrinth',
            query: input.query,
            total: result.total_hits,
            items: result.hits.map(project => ({
              provider: 'modrinth',
              projectType: project.project_type,
              id: project.project_id,
              title: project.title,
              description: project.description,
              icon: project.icon_url,
              author: project.author,
              downloads: project.downloads,
            })),
          },
        }
      },
      async getModrinthVersions(input, signal) {
        const instance = currentInstance(context)
        const versions = await clientModrinthV2.getProjectVersions(input.project, {
          gameVersions: input.gameVersion ?? instance.runtime.minecraft ? [input.gameVersion ?? instance.runtime.minecraft] : undefined,
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
            installRef: `modrinth:${input.project}@${version.id}`,
          })),
        }
      },
      async searchCurseforge(input, signal) {
        const instance = currentInstance(context)
        const result = await clientCurseforgeV1.searchMods({
          searchFilter: input.query,
          classId: 6,
          gameVersion: input.gameVersion ?? instance.runtime.minecraft,
          pageSize: input.limit,
        }, signal)
        return {
          total: result.pagination.totalCount,
          projects: result.data,
          presentation: {
            type: 'market-project-list',
            source: 'curseforge',
            query: input.query,
            total: result.pagination.totalCount,
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
        const result = await clientCurseforgeV1.getModFiles({
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
            installRef: `curseforge:${input.project}/${file.id}`,
          })),
        }
      },
      async listLoaderVersions(input) {
        const minecraft = input.minecraft ?? currentInstance(context).runtime.minecraft
        const result = await loaderVersions(input.loader, minecraft, input.refresh)
        const versions = Array.isArray(result) ? result : result.loaderVersions
        return { loader: input.loader, minecraft, versions: versions.slice(0, input.limit) }
      },
      async installLoader(input) {
        const instance = currentInstance(context)
        const minecraft = instance.runtime.minecraft
        const available = await loaderVersions(input.loader, minecraft, false)
        let version = input.version
        if (input.loader === 'forge') {
          const values = available as Awaited<ReturnType<typeof metadata.getForgeVersions>>
          version ??= values.find(value => value.type === 'recommended')?.version ?? values[0]?.version
        } else if (input.loader === 'neoforge') {
          version ??= getLatestNeoforge(available as string[])
        } else {
          const values = (available as Awaited<ReturnType<typeof metadata.getFabricVersions>>).loaderVersions
          version ??= values.find(value => value.stable !== false)?.version ?? values[0]?.version
        }
        if (!version) throw new Error(`No ${input.loader} version is available for Minecraft ${minecraft}`)
        await confirmInstall('Install mod loader', `Install ${input.loader} ${version} into ${instance.name}?`, `${minecraft} / ${input.loader} ${version}`)
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
        const installedVersion = await versionInstaller.installRuntime(context.scope, runtime)
        return { ok: true, instance: context.scope, loader: input.loader, version, installedVersion }
      },
    }
  }

  async function createBashTool(context: AgentRunContext): Promise<AgentTool> {
    const runtimeCommands = createAgentRuntimeCommands(createCommandOperations(context))
    const runtimeByName = new Map(runtimeCommands.map(command => [command.name, command]))
    const allowedCommands = () => commandHost.registry.list({ mode: 'cli' })
      .filter(command => isAgentCommandAllowed(command.id))
      .map(command => ({ command, name: command.cli?.name ?? command.id.replace(/\./g, ' ') }))
    const rootHelp = () => {
      const runtimeHelp = runtimeCommands.map(command => `  ${command.name.padEnd(28)} ${command.description}`).join('\n')
      const commandHelp = allowedCommands()
        .map(({ command, name }) => `  ${name.padEnd(28)} ${command.title}`)
        .join('\n')
      return `Allowed XMCL commands:\n${commandHelp}\n\nAgent renderer commands:\n${runtimeHelp}\n\nRun \`help <command>\` for exact syntax.`
    }
    const commandHelp = (name: string) => {
      const runtime = runtimeByName.get(name)
      if (runtime) return [`Usage: ${runtime.usage}`, '', runtime.description, '', ...runtime.details].join('\n')
      const command = allowedCommands().find(value => value.name === name)?.command
      if (!command) throw new Error(`Unknown command: ${name}`)
      return formatCommandHelp(command, { programName: 'bash' })
    }
    return {
      name: 'bash',
      label: 'XMCL command',
      description: 'Run one restricted XMCL renderer command.',
      parameters: Type.Object({ command: Type.String() }),
      executionMode: 'sequential',
      async execute(_id, args: any, signal) {
        let argv = tokenize(args.command)
        if (argv[0] === 'bash') argv = argv.slice(1)
        assertAgentCommandSyntax(argv)
        if (!argv.length || (argv[0] === 'help' && argv.length === 1)) return textResult(rootHelp())
        if (argv[0] === 'help') return textResult(commandHelp(argv.slice(1).join(' ')))
        const runtime = runtimeByName.get(argv[0])
        if (runtime) return textResult(await runtime.execute(argv.slice(1), signal))
        const candidates = allowedCommands()
          .sort((a, b) => b.name.length - a.name.length)
        const match = candidates.find(candidate => args.command === candidate.name || args.command.startsWith(`${candidate.name} `))
        if (!match) throw new Error('Unsupported command. Run `help` to list commands.')
        const parsed = parseCli([match.name, ...tokenize(args.command.slice(match.name.length).trim())], commandHost.registry)
        if (parsed.kind === 'error') throw new Error(parsed.message)
        if (parsed.kind !== 'command') return textResult(commandHelp(match.name))
        if (parsed.commandId.endsWith('.install')) {
          parsed.input.instance = context.scope
          await confirmInstall(match.command.title, `Allow the agent to run ${match.command.title}?`, args.command)
        }
        const result = await commandHost.dispatch(parsed.commandId, parsed.input)
        return textResult({ result })
      },
    }
  }

  function createUiTool(): AgentTool {
    return {
      name: 'ui',
      label: 'Launcher UI',
      description: 'Navigate or inspect the XMCL user interface. The run instance and user cannot be changed.',
      parameters: Type.Union([
        Type.Object({ action: Type.Literal('navigate'), path: Type.String() }),
        Type.Object({ action: Type.Literal('confirm'), message: Type.String(), destructive: Type.Optional(Type.Boolean()) }),
        Type.Object({ action: Type.Literal('query_dom'), selector: Type.String(), limit: Type.Optional(Type.Number()) }),
        Type.Object({ action: Type.Literal('get_computed_style'), selector: Type.String(), properties: Type.Optional(Type.Array(Type.String())) }),
        Type.Object({ action: Type.Literal('get_dom_outline'), selector: Type.Optional(Type.String()), maxDepth: Type.Optional(Type.Number()) }),
      ]),
      executionMode: 'sequential',
      async execute(_id, input, signal) {
        return textResult(await uiHandler(input as any, signal))
      },
    }
  }

  async function createLauncherTools(context: AgentRunContext) {
    return [
      ...await createVfsTools(context),
      await createBashTool(context),
      createUiTool(),
      ...createAgentManagementTools(capabilities.context, capabilities.services),
      ...createAgentServerTools(capabilities.context),
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
    parameters: Type.Union([
      Type.Object({ action: Type.Literal('query_dom'), selector: Type.String(), limit: Type.Optional(Type.Number()) }),
      Type.Object({ action: Type.Literal('get_computed_style'), selector: Type.String(), properties: Type.Optional(Type.Array(Type.String())) }),
      Type.Object({ action: Type.Literal('get_dom_outline'), selector: Type.Optional(Type.String()), maxDepth: Type.Optional(Type.Number()) }),
    ]),
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
