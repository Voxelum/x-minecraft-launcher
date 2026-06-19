import type { InstanceService, ModpackService } from '@xmcl/runtime-api'
import type { PartialRuntimeVersions } from '@xmcl/instance'
import type { AgentContext } from './tools'
import type { Tool } from './loop'

/**
 * Services captured during agent setup and handed to the lazy `instance_admin`
 * pack (mounted mid-loop, outside any Vue injection context).
 */
export interface InstanceAdminServices {
  instanceService: Pick<InstanceService, 'createInstance' | 'duplicateInstance' | 'deleteInstance'>
  modpackService: Pick<ModpackService, 'importModpack'>
}

/**
 * Lazy-loaded instance lifecycle tools. Triggered by
 * `load_tools(["instance_admin"])`.
 *
 * These act on instances as a whole — create / duplicate / delete, or import a
 * modpack file from disk as a new instance — rather than on an instance's
 * contents. Deleting an instance is destructive; confirm with the user first.
 */
export function createInstanceAdminTools(ctx: AgentContext, { instanceService, modpackService }: InstanceAdminServices): Tool[] {
  return [
    {
      name: 'create_instance',
      description: 'Create a new instance. `name` is required. `runtime` sets the Minecraft & mod-loader versions (use exactly one loader). The new instance becomes the selected one. Afterwards run `diagnose_instance` / `repair_instance` to install its version before launching.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name for the new instance' },
          description: { type: 'string', description: 'Optional description' },
          runtime: {
            type: 'object',
            description: 'Minecraft & mod-loader versions. Use exactly one loader.',
            properties: {
              minecraft: { type: 'string', description: 'Minecraft version, e.g. "1.20.1" (defaults to latest release if omitted)' },
              forge: { type: 'string', description: 'Forge version' },
              neoForged: { type: 'string', description: 'NeoForge version' },
              fabricLoader: { type: 'string', description: 'Fabric loader version' },
              quiltLoader: { type: 'string', description: 'Quilt loader version' },
              optifine: { type: 'string', description: 'OptiFine version' },
            },
          },
        },
        required: ['name'],
      },
      async execute(args) {
        const name = String(args.name ?? '').trim()
        if (!name) return { error: 'name is required' }
        const runtime = (args.runtime && typeof args.runtime === 'object' && !Array.isArray(args.runtime))
          ? args.runtime as PartialRuntimeVersions
          : undefined
        const path = await instanceService.createInstance({
          name,
          ...(args.description ? { description: String(args.description) } : {}),
          ...(runtime ? { runtime } : {}),
        })
        ctx.selectedInstancePath.value = path
        return { ok: true, path, selected: true }
      },
    },
    {
      name: 'duplicate_instance',
      description: 'Duplicate an existing instance (its settings and content). Defaults to the current instance; pass `path` to duplicate a different one. The copy becomes the selected instance.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Instance path to duplicate (defaults to current)' },
        },
      },
      async execute(args) {
        const src = String(args.path ?? ctx.instance.value.path ?? '')
        if (!src) return { error: 'no instance selected' }
        const path = await instanceService.duplicateInstance(src)
        ctx.selectedInstancePath.value = path
        return { ok: true, path, from: src, selected: true }
      },
    },
    {
      name: 'delete_instance',
      description: 'Permanently delete an instance. DESTRUCTIVE and irreversible — confirm with the user first. Defaults to the current instance; pass `path` to target another. `deleteData: true` also removes the instance\'s data files from disk (default false).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Instance path to delete (defaults to current)' },
          deleteData: { type: 'boolean', description: 'Also delete the instance data files from disk (default false)' },
        },
      },
      async execute(args) {
        const target = String(args.path ?? ctx.instance.value.path ?? '')
        if (!target) return { error: 'no instance selected' }
        await instanceService.deleteInstance(target, !!args.deleteData)
        return { ok: true, deleted: target, deletedData: !!args.deleteData }
      },
    },
    {
      name: 'import_modpack',
      description: 'Import a modpack file (CurseForge / Modrinth / MCBBS `.zip` or `.mrpack`) from disk as a new instance. `path` is the absolute modpack file path. The new instance becomes selected. Returns its path and runtime.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the modpack file on disk' },
        },
        required: ['path'],
      },
      async execute(args) {
        const modpackPath = String(args.path ?? '')
        if (!modpackPath) return { error: 'path is required' }
        const result = await modpackService.importModpack(modpackPath)
        if (result?.instancePath) ctx.selectedInstancePath.value = result.instancePath
        return { ok: true, path: result?.instancePath, runtime: result?.runtime, version: result?.version, selected: true }
      },
    },
  ]
}
