import type { AgentContext } from './tools'
import type { Tool } from './loop'

/**
 * Lazy-loaded local-server tools. Triggered by `load_tools(["server"])`.
 *
 * Mirrors the "Launch server" dialog: install the dedicated-server build for
 * the current instance, accept the Minecraft EULA / edit server.properties,
 * deploy mods into the server folder, then start or stop the server. Every
 * operation targets the *current* instance's LOCAL server — not the client
 * game (use `launch_game` / `repair_instance` for the client side).
 */
export function createServerTools(ctx: AgentContext): Tool[] {
  return [
    {
      name: 'install_server',
      description: 'Download & install the dedicated-server build for the current instance (the Minecraft server jar, the mod-loader server, and their dependencies) so it can be launched. Idempotent — reuses an already-installed server version. The mod-loader (Forge / NeoForge / Fabric / Quilt) and Minecraft version are taken from the instance runtime; change them first with `edit_instance` if needed.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        if (!ctx.instance.value.path) return { error: 'no instance selected' }
        return ctx.installServer()
      },
    },
    {
      name: 'set_server_eula',
      description: 'Accept (or revoke) the Minecraft EULA for the current instance\'s server. A server CANNOT be launched until the EULA is accepted. Only set `accepted: true` when the user has explicitly agreed to the Minecraft EULA (https://aka.ms/MinecraftEULA) — do not accept it on their behalf without confirmation.',
      parameters: {
        type: 'object',
        properties: {
          accepted: { type: 'boolean', description: 'true to accept the EULA, false to revoke it' },
        },
        required: ['accepted'],
      },
      async execute(args) {
        if (!ctx.instance.value.path) return { error: 'no instance selected' }
        return ctx.setServerEula(!!args.accepted)
      },
    },
    {
      name: 'set_server_properties',
      description: 'Edit the server.properties of the current instance\'s server. Only the keys you pass are changed; omitted keys keep their current value (read them first with `diagnose_server`). Common keys: `port` (number, default 25565), `motd` (string), `max-players` (number), `online-mode` (boolean), `difficulty`, `gamemode`, `pvp`, `level-name`, `white-list`.',
      parameters: {
        type: 'object',
        properties: {
          properties: {
            type: 'object',
            description: 'A map of server.properties keys to values (string / number / boolean), e.g. { "port": 25566, "motd": "My Server", "max-players": 10, "online-mode": false }',
          },
        },
        required: ['properties'],
      },
      async execute(args) {
        if (!ctx.instance.value.path) return { error: 'no instance selected' }
        const props = args.properties
        if (!props || typeof props !== 'object' || Array.isArray(props)) {
          return { error: 'properties must be an object mapping server.properties keys to values' }
        }
        return ctx.setServerProperties(props as Record<string, string | number | boolean>)
      },
    },
    {
      name: 'deploy_server_mods',
      description: 'Deploy mods into the server folder so the running server loads them. With no `paths`, deploys every enabled mod that is server-compatible (skips client-only mods). Pass explicit `paths` (the virtual `mods/<fileName>` paths from `vfs_list mods`, or absolute mod paths) to deploy a specific selection. This mirrors the mod selection in the launch-server dialog.',
      parameters: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional explicit list of mod paths to deploy. Omit to deploy all server-compatible enabled mods.',
          },
        },
      },
      async execute(args) {
        if (!ctx.instance.value.path) return { error: 'no instance selected' }
        const raw = Array.isArray(args.paths) ? args.paths.map((p) => String(p)) : undefined
        // Resolve virtual `mods/<fileName>` paths to real mod file paths.
        const paths = raw?.map((p) => {
          const name = p.replace(/^\.?\/+/, '').replace(/^mods\//, '')
          const mod = ctx.mods.value.find((m) => m.path === p || m.fileName === name || m.modId === name)
          return mod?.path ?? p
        })
        return ctx.deployServerMods(paths)
      },
    },
    {
      name: 'launch_server',
      description: 'Launch the current instance as a local dedicated server. Installs the server build first when it is missing. The Minecraft EULA must already be accepted (use `set_server_eula`) — otherwise this fails. Use `deploy_server_mods` beforehand if the server should load mods. Returns `{ ok: true }` only if the server process stays up; if it exits immediately (a broken/incomplete install, e.g. a missing jar) it returns `{ ok: false, error }` — then read the newest `launch-failures/` entry with `vfs_read` for the exact cause.',
      parameters: {
        type: 'object',
        properties: {
          nogui: { type: 'boolean', description: 'Start the server without its built-in GUI window (headless). Default false.' },
        },
      },
      async execute(args) {
        if (!ctx.instance.value.path) return { error: 'no instance selected' }
        return ctx.launchServer({ nogui: !!args.nogui })
      },
    },
    {
      name: 'kill_server',
      description: 'Stop the running dedicated server for the current instance.',
      parameters: {
        type: 'object',
        properties: {
          force: { type: 'boolean', description: 'Force-terminate the process tree' },
        },
      },
      async execute(args) {
        await ctx.killGame('server', !!args.force)
        return { ok: true }
      },
    },
    {
      name: 'write_server_file',
      description: [
        'Overwrite a server admin file with raw text (full-content write, not a patch).',
        'Allowed files: `ops.json`, `whitelist.json`, `banned-players.json`, `banned-ips.json`,',
        '`usercache.json`, `server.properties`, `eula.txt`. Read the current content first with',
        '`vfs_read server/<file>`, modify it, and write the whole file back. For these JSON files',
        'pass valid JSON text. To change individual server.properties keys prefer `set_server_properties`.',
      ].join('\n'),
      parameters: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            enum: ['ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'usercache.json', 'server.properties', 'eula.txt'],
            description: 'The server file to overwrite',
          },
          content: { type: 'string', description: 'The full new file content (raw text)' },
        },
        required: ['file', 'content'],
      },
      async execute(args) {
        if (!ctx.instance.value.path) return { error: 'no instance selected' }
        const file = String(args.file ?? '')
        if (!file) return { error: 'file is required' }
        return ctx.setServerFile(file, String(args.content ?? ''))
      },
    },
  ]
}
