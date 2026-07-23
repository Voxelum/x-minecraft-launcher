import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'
import { formatCommandHelp, formatHelp, parseCli } from '@xmcl/runtime-api'
import type { AgentConversationKey, AgentUiAction } from '@xmcl/runtime-api'
import type { Resource } from '@xmcl/resource'
import type { LauncherApp } from '~/app'
import { kCommandHost } from '~/commands'
import {
  InstanceLogService,
  InstanceModsService,
  InstanceOptionsService,
  InstanceResourcePackService,
  InstanceSavesService,
  InstanceService,
  InstanceShaderPacksService,
} from '~/instance'
import { LaunchService } from '~/launch'
import { ThemeService } from '~/theme'
import { AgentBridge } from './AgentBridge'

interface AgentToolContext {
  app: LauncherApp
  bridge: AgentBridge
  runId: string
  bridgeId: () => string
  key: AgentConversationKey
  readonly: boolean
}

function textResult<T>(value: unknown, details?: T): AgentToolResult<T | unknown> {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return { content: [{ type: 'text', text }], details: details ?? value }
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

async function confirm(ctx: AgentToolContext, message: string, signal?: AbortSignal) {
  if (ctx.readonly) throw new Error('This agent run is read-only')
  const result = await ctx.bridge.executeUi(
    ctx.bridgeId(),
    ctx.runId,
    { action: 'confirm', message, destructive: true },
    5 * 60_000,
    signal,
  )
  if (result !== true) throw new Error('User declined the destructive action')
}

function uiTool(ctx: AgentToolContext): AgentTool {
  return {
    name: 'ui',
    label: 'Launcher UI',
    description: 'Interact with the XMCL user interface. Use only when navigation, UI selection, confirmation, or DOM inspection is required.',
    parameters: Type.Union([
      Type.Object({ action: Type.Literal('navigate'), path: Type.String() }),
      Type.Object({ action: Type.Literal('select_instance'), path: Type.String() }),
      Type.Object({ action: Type.Literal('select_account'), id: Type.String() }),
      Type.Object({ action: Type.Literal('confirm'), message: Type.String(), destructive: Type.Optional(Type.Boolean()) }),
      Type.Object({ action: Type.Literal('query_dom'), selector: Type.String(), limit: Type.Optional(Type.Number()) }),
      Type.Object({ action: Type.Literal('get_computed_style'), selector: Type.String(), properties: Type.Optional(Type.Array(Type.String())) }),
      Type.Object({ action: Type.Literal('get_dom_outline'), selector: Type.Optional(Type.String()), maxDepth: Type.Optional(Type.Number()) }),
    ]),
    executionMode: 'sequential',
    async execute(_id, input, signal) {
      const result = await ctx.bridge.executeUi(ctx.bridgeId(), ctx.runId, input as AgentUiAction, 5 * 60_000, signal)
      return textResult(result)
    },
  }
}

async function createVfsTools(ctx: AgentToolContext): Promise<AgentTool[]> {
  const instancePath = ctx.key.scope
  const instanceService = await ctx.app.registry.getOrCreate(InstanceService)
  const modsService = await ctx.app.registry.getOrCreate(InstanceModsService)
  const resourcePackService = await ctx.app.registry.getOrCreate(InstanceResourcePackService)
  const shaderPackService = await ctx.app.registry.getOrCreate(InstanceShaderPacksService)
  const savesService = await ctx.app.registry.getOrCreate(InstanceSavesService)
  const optionsService = await ctx.app.registry.getOrCreate(InstanceOptionsService)
  const logService = await ctx.app.registry.getOrCreate(InstanceLogService)
  const launchService = await ctx.app.registry.getOrCreate(LaunchService)

  const resources = async (kind: 'mods' | 'resourcepacks' | 'shaderpacks') => {
    const service = kind === 'mods' ? modsService : kind === 'resourcepacks' ? resourcePackService : shaderPackService
    return (await service.watch(instancePath)).files
  }

  const list = async (path: string) => {
    const clean = path.replace(/^\.?\//, '').replace(/\/$/, '')
    if (!clean) {
      return {
        path: instancePath,
        entries: ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'logs', 'crash-reports', 'launch-failures', 'config', 'game-processes', 'instance.json', 'options.txt'],
      }
    }
    if (clean === 'mods' || clean === 'resourcepacks' || clean === 'shaderpacks') return (await resources(clean)).map(summarizeResource)
    if (clean === 'saves') return (await savesService.watch(instancePath)).saves
    if (clean === 'logs') return logService.listLogs(instancePath)
    if (clean === 'crash-reports') return logService.listCrashReports(instancePath)
    if (clean === 'launch-failures') return logService.listLaunchFailures(instancePath)
    if (clean === 'config') return optionsService.getInstanceConfigFiles(instancePath)
    if (clean === 'game-processes') return (await launchService.getGameProcesses()).filter(process => process.options.gameDirectory === instancePath)
    throw new Error(`Not a virtual directory: ${path}`)
  }

  const read = async (path: string, tailLines?: number) => {
    const clean = path.replace(/^\.?\//, '')
    if (clean === 'instance.json') {
      const state = await instanceService.getSharedInstancesState()
      return state.all[instancePath] ?? { error: 'instance not found' }
    }
    if (clean === 'options.txt') return optionsService.getGameOptions(instancePath)
    const [kind, ...parts] = clean.split('/')
    const rest = parts.join('/')
    if (kind === 'mods' || kind === 'resourcepacks' || kind === 'shaderpacks') {
      const resource = (await resources(kind)).find(value => value.fileName === rest || value.path === rest || value.name === rest)
      return resource ? summarizeResource(resource) : { error: `${kind} entry not found: ${rest}` }
    }
    if (kind === 'saves') {
      const save = (await savesService.watch(instancePath)).saves.find(value => value.name === rest || value.path === rest)
      return save ?? { error: `save not found: ${rest}` }
    }
    if (kind === 'logs' || kind === 'launch-failures') {
      const content = await logService.getLogContent(instancePath, rest)
      const count = Math.min(Math.max(1, tailLines ?? 200), 2000)
      return content.split('\n').slice(-count).join('\n')
    }
    if (kind === 'crash-reports') return logService.getCrashReportContent(instancePath, rest)
    if (kind === 'config') return optionsService.getInstanceConfig(instancePath, rest)
    if (kind === 'game-processes') {
      const pid = Number(parts.at(-1))
      return await launchService.getGameProcess(pid) ?? { error: `game process not found: ${rest}` }
    }
    return { error: `unknown virtual path: ${path}` }
  }

  const vfsList: AgentTool = {
    name: 'vfs_list',
    label: 'List instance files',
    description: 'List a virtual directory for the current instance.',
    parameters: Type.Object({ path: Type.Optional(Type.String()) }),
    executionMode: 'sequential',
    async execute(_id, args: any) {
      return textResult(await list(String(args.path ?? '')))
    },
  }
  const vfsRead: AgentTool = {
    name: 'vfs_read',
    label: 'Read instance data',
    description: 'Read a virtual instance file or resource entry.',
    parameters: Type.Object({ path: Type.String(), tailLines: Type.Optional(Type.Number()) }),
    executionMode: 'sequential',
    async execute(_id, args: any) {
      return textResult(await read(args.path, args.tailLines))
    },
  }
  const vfsRm: AgentTool = {
    name: 'vfs_rm',
    label: 'Delete instance files',
    description: 'Delete supported virtual paths after explicit user confirmation.',
    parameters: Type.Object({ paths: Type.Array(Type.String()) }),
    executionMode: 'sequential',
    async execute(_id, args: any, signal) {
      await confirm(ctx, `Delete these instance paths?\n${args.paths.join('\n')}`, signal)
      const results: unknown[] = []
      for (const path of args.paths) {
        const [kind, ...parts] = path.replace(/^\.?\//, '').split('/')
        const rest = parts.join('/')
        if (kind === 'mods' || kind === 'resourcepacks' || kind === 'shaderpacks') {
          const service = kind === 'mods' ? modsService : kind === 'resourcepacks' ? resourcePackService : shaderPackService
          const resource = (await resources(kind)).find(value => value.fileName === rest || value.path === rest || value.name === rest)
          if (!resource) throw new Error(`${kind} entry not found: ${rest}`)
          await service.uninstall({ path: instancePath, files: [resource.path] })
        } else if (kind === 'saves') {
          await savesService.deleteSave({ instancePath, saveName: rest })
        } else if (kind === 'logs' || kind === 'launch-failures') {
          await logService.removeLog(instancePath, rest)
        } else if (kind === 'crash-reports') {
          await logService.removeCrashReport(instancePath, rest)
        } else if (kind === 'config') {
          await optionsService.removeInstanceConfig(instancePath, rest)
        } else {
          throw new Error(`Unsupported delete path: ${path}`)
        }
        results.push({ deleted: path })
      }
      return textResult({ ok: true, results })
    },
  }

  const editConfig: AgentTool = {
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
      const content = await optionsService.getInstanceConfig(instancePath, clean)
      const index = content.indexOf(args.match_string)
      if (index < 0) throw new Error(`match_string not found in ${args.path}`)
      const next = args.all === false
        ? content.slice(0, index) + args.replace_string + content.slice(index + args.match_string.length)
        : content.split(args.match_string).join(args.replace_string)
      await optionsService.setInstanceConfig(instancePath, clean, next)
      return textResult({ ok: true, path: args.path })
    },
  }
  const editInstance: AgentTool = {
    name: 'edit_instance',
    label: 'Edit instance',
    description: 'Edit fields on the current instance. Omitted fields remain unchanged.',
    parameters: Type.Object({}, { additionalProperties: true }),
    executionMode: 'sequential',
    async execute(_id, args: any) {
      await instanceService.editInstance({ ...args, instancePath } as any)
      return textResult({ ok: true, edited: Object.keys(args) })
    },
  }
  return [vfsList, vfsRead, vfsRm, editConfig, editInstance]
}

async function createBashTool(ctx: AgentToolContext): Promise<AgentTool> {
  const host = await ctx.app.registry.get(kCommandHost)
  return {
    name: 'bash',
    label: 'XMCL command',
    description: 'Run a restricted XMCL command. Use `help` to list commands and `<command> --help` for details.',
    parameters: Type.Object({ command: Type.String() }),
    executionMode: 'sequential',
    async execute(_id, args: any, signal) {
      const argv = tokenize(args.command)
      if (argv[0] === 'help' && argv.length === 1) return textResult(formatHelp(host.registry, { programName: 'bash' }))
      if (argv[0] === 'help' && argv.length > 1) {
        const name = argv.slice(1).join(' ')
        const command = host.registry.list({ mode: 'cli' }).find(value => (value.cli?.name ?? value.id.replace(/\./g, ' ')) === name)
        if (!command) throw new Error(`Unknown command: ${name}`)
        return textResult(formatCommandHelp(command, { programName: 'bash' }))
      }
      const candidates = host.registry.list({ mode: 'cli' })
        .map(command => ({ command, name: command.cli?.name ?? command.id.replace(/\./g, ' ') }))
        .sort((a, b) => b.name.length - a.name.length)
      const match = candidates.find(candidate => args.command === candidate.name || args.command.startsWith(`${candidate.name} `))
      if (!match) throw new Error(`Unsupported command. Run \`help\` to list commands.`)
      const tail = args.command.slice(match.name.length).trim()
      const parsed = parseCli([match.name, ...tokenize(tail)], host.registry)
      if (parsed.kind === 'error') throw new Error(parsed.message)
      if (parsed.kind !== 'command') throw new Error(`Cannot execute command: ${args.command}`)
      const output: unknown[] = []
      const result = await host.dispatch(parsed.commandId, parsed.input, {
        mode: 'renderer',
        signal,
        out: {
          log: message => output.push(message),
          json: value => output.push(value),
          table: rows => output.push(rows),
        },
      })
      return textResult({ result, output })
    },
  }
}

async function createCssTools(ctx: AgentToolContext): Promise<AgentTool[]> {
  const themeService = await ctx.app.registry.getOrCreate(ThemeService)
  return [
    {
      name: 'get_custom_css',
      label: 'Read custom CSS',
      description: 'Read the current global custom CSS and enabled state.',
      parameters: Type.Object({}),
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
      async execute(_id, args: any) {
        await themeService.setCustomCss(args.css)
        return textResult({ ok: true, length: args.css.length })
      },
    },
    {
      name: 'set_custom_css_enabled',
      label: 'Enable custom CSS',
      description: 'Enable or disable global custom CSS without deleting it.',
      parameters: Type.Object({ enabled: Type.Boolean() }),
      executionMode: 'sequential',
      async execute(_id, args: any) {
        const current = await themeService.getCurrentTheme() ?? { ui: 'keystone', version: 1, assets: {}, settings: {} }
        await themeService.setCurrentTheme({
          ...current,
          settings: { ...current.settings, customCssEnabled: args.enabled },
        })
        return textResult({ ok: true, enabled: args.enabled })
      },
    },
  ]
}

export async function createRuntimeAgentTools(ctx: AgentToolContext) {
  if (ctx.key.agentId === 'css') return [...await createCssTools(ctx), uiTool(ctx)]
  return [...await createVfsTools(ctx), await createBashTool(ctx), uiTool(ctx)]
}
