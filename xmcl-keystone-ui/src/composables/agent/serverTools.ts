import { requestAgentConfirmation } from './confirm'
import type { AgentCapabilityContext } from './capabilityContext'
import { createAgentTools } from './toolSupport'

async function confirmAction(title: string, message: string, details: string[], destructive = false) {
  const accepted = await requestAgentConfirmation({
    action: 'confirm',
    title,
    message,
    details,
    destructive,
    confirmLabel: destructive ? 'Stop' : 'Continue',
  })
  if (!accepted) throw new Error('User declined the action')
}

export function createAgentServerTools(context: AgentCapabilityContext) {
  return createAgentTools([
    {
      name: 'diagnose_server',
      label: 'Diagnose server',
      readonly: true,
      description: 'Report the selected instance local server installation, EULA, properties, running state, and deployed mods.',
      parameters: { type: 'object', properties: {} },
      execute: () => context.getServerStatus(),
    },
    {
      name: 'install_server',
      label: 'Install server',
      description: 'Install the dedicated server build for the selected instance.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        await confirmAction('Install server', 'Install the dedicated server build?', [context.instance.value.name])
        return context.installServer()
      },
    },
    {
      name: 'set_server_eula',
      label: 'Set server EULA',
      description: 'Accept or revoke the Minecraft EULA. Acceptance always requires explicit confirmation.',
      parameters: {
        type: 'object',
        properties: { accepted: { type: 'boolean' } },
        required: ['accepted'],
      },
      async execute(args) {
        const accepted = !!args.accepted
        if (accepted) {
          await confirmAction(
            'Minecraft EULA',
            'Confirm that you agree to the Minecraft EULA for this server.',
            ['https://aka.ms/MinecraftEULA'],
          )
        }
        return context.setServerEula(accepted)
      },
    },
    {
      name: 'set_server_properties',
      label: 'Edit server properties',
      description: 'Patch server.properties with the provided key/value map.',
      parameters: {
        type: 'object',
        properties: { properties: { type: 'object' } },
        required: ['properties'],
      },
      execute(args) {
        if (!args.properties || typeof args.properties !== 'object' || Array.isArray(args.properties)) {
          return { error: 'properties must be an object' }
        }
        return context.setServerProperties(args.properties)
      },
    },
    {
      name: 'deploy_server_mods',
      label: 'Deploy server mods',
      description: 'Deploy selected mods, or all enabled server-compatible mods, into the local server folder.',
      parameters: {
        type: 'object',
        properties: { paths: { type: 'array', items: { type: 'string' } } },
      },
      async execute(args) {
        const raw = Array.isArray(args.paths) ? args.paths.map(String) : undefined
        const paths = raw?.map((path: string) => {
          const name = path.replace(/^\.?\/+/, '').replace(/^mods\//, '')
          const mod = context.mods.value.find(value => value.path === path || value.fileName === name || value.modId === name)
          return mod?.path ?? path
        })
        await confirmAction('Deploy server mods', 'Deploy mods into the local server folder?', paths ?? ['All server-compatible enabled mods'])
        return context.deployServerMods(paths)
      },
    },
    {
      name: 'launch_server',
      label: 'Launch server',
      description: 'Launch the selected instance as a local dedicated server. The EULA must already be accepted.',
      parameters: {
        type: 'object',
        properties: { nogui: { type: 'boolean' } },
      },
      async execute(args) {
        await confirmAction('Launch server', 'Launch the local dedicated server?', [context.instance.value.name])
        return context.launchServer({ nogui: !!args.nogui })
      },
    },
    {
      name: 'kill_server',
      label: 'Stop server',
      description: 'Stop the running local dedicated server.',
      parameters: {
        type: 'object',
        properties: { force: { type: 'boolean' } },
      },
      async execute(args) {
        await confirmAction('Stop server', 'Stop the running local server?', [context.instance.value.name], true)
        await context.killGame('server', !!args.force)
        return { ok: true }
      },
    },
    {
      name: 'write_server_file',
      label: 'Write server file',
      description: 'Overwrite an allowlisted top-level server file after confirmation.',
      parameters: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            enum: ['ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'usercache.json', 'server.properties', 'eula.txt'],
          },
          content: { type: 'string' },
        },
        required: ['file', 'content'],
      },
      async execute(args) {
        const file = String(args.file ?? '')
        if (!file) return { error: 'file is required' }
        await confirmAction('Write server file', `Overwrite server/${file}?`, [context.instance.value.name])
        return context.setServerFile(file, String(args.content ?? ''))
      },
    },
  ])
}
