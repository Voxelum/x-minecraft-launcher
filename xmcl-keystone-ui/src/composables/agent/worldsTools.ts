import type { InstanceSavesService } from '@xmcl/runtime-api'
import type { AgentContext } from './tools'
import type { Tool } from './loop'

/**
 * Save service subset captured during agent setup and handed to the lazy
 * `worlds` pack (mounted mid-loop, outside any Vue injection context).
 */
export interface WorldsServices {
  savesService: Pick<InstanceSavesService,
    'importSave' | 'exportSave' | 'cloneSave' | 'deleteSave' | 'linkSaveAsServerWorld' | 'getLinkedSaveWorld'>
}

/**
 * Lazy-loaded world/save tools. Triggered by `load_tools(["worlds"])`.
 *
 * Mirrors the saves page: import a world from a zip/folder, export one out,
 * clone/duplicate, delete, and link a singleplayer world as the dedicated
 * server world. All operations target the *current* instance unless noted.
 */
export function createWorldsTools(ctx: AgentContext, { savesService }: WorldsServices): Tool[] {
  function instancePath(): string | undefined {
    return ctx.instance.value.path || undefined
  }
  function findSave(name: string) {
    return ctx.saves.value.find((s) => s.name === name || s.path === name)
  }

  return [
    {
      name: 'list_worlds',
      readonly: true,
      description: 'List the worlds (saves) in the current instance: folder name, level name, game version, and last-played time. Use the folder `name` as the `saveName` for the other world tools.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        if (!instancePath()) return { error: 'no instance selected' }
        return ctx.saves.value.map((s) => ({
          saveName: s.name,
          levelName: s.levelName,
          gameVersion: s.gameVersion,
          lastPlayed: s.lastPlayed,
          path: s.path,
        }))
      },
    },
    {
      name: 'import_world',
      description: 'Import a world into the current instance from a local `.zip` file or a world folder on disk. `path` is the absolute source path; optional `saveName` overrides the destination folder name (defaults to the source basename). Returns the imported save path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to a world zip or folder on disk' },
          saveName: { type: 'string', description: 'Optional destination world folder name' },
        },
        required: ['path'],
      },
      async execute(args) {
        const inst = instancePath()
        if (!inst) return { error: 'no instance selected' }
        const path = String(args.path ?? '')
        if (!path) return { error: 'path is required' }
        const imported = await savesService.importSave({
          instancePath: inst,
          path,
          saveName: args.saveName ? String(args.saveName) : undefined,
        })
        return { ok: true, importedPath: imported }
      },
    },
    {
      name: 'export_world',
      description: 'Export a world from the current instance to a local destination path. `saveName` is the world folder name (see `list_worlds`); `destination` is the absolute output path; `zip` (default true) exports a zip, otherwise a folder.',
      parameters: {
        type: 'object',
        properties: {
          saveName: { type: 'string', description: 'World folder name to export' },
          destination: { type: 'string', description: 'Absolute output file/folder path' },
          zip: { type: 'boolean', description: 'Export as a zip (default true)' },
        },
        required: ['saveName', 'destination'],
      },
      async execute(args) {
        const inst = instancePath()
        if (!inst) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        const destination = String(args.destination ?? '')
        if (!destination) return { error: 'destination is required' }
        await savesService.exportSave({
          instancePath: inst,
          saveName,
          destination,
          zip: args.zip === undefined ? true : !!args.zip,
        })
        return { ok: true, saveName, destination }
      },
    },
    {
      name: 'clone_world',
      description: 'Duplicate a world inside the current instance (or into another instance by path). `saveName` is the source world folder; optional `newSaveName` names the copy; optional `destInstancePath` clones into a different instance instead of the current one.',
      parameters: {
        type: 'object',
        properties: {
          saveName: { type: 'string', description: 'Source world folder name' },
          newSaveName: { type: 'string', description: 'Optional name for the clone' },
          destInstancePath: { type: 'string', description: 'Optional destination instance path (defaults to current)' },
        },
        required: ['saveName'],
      },
      async execute(args) {
        const inst = instancePath()
        if (!inst) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        await savesService.cloneSave({
          srcInstancePath: inst,
          destInstancePath: args.destInstancePath ? String(args.destInstancePath) : inst,
          saveName,
          newSaveName: args.newSaveName ? String(args.newSaveName) : undefined,
        })
        return { ok: true, saveName, newSaveName: args.newSaveName ? String(args.newSaveName) : undefined }
      },
    },
    {
      name: 'delete_world',
      description: 'Permanently delete a world from the current instance. This is destructive and irreversible — confirm with the user before calling. `saveName` is the world folder name (see `list_worlds`).',
      parameters: {
        type: 'object',
        properties: {
          saveName: { type: 'string', description: 'World folder name to delete' },
        },
        required: ['saveName'],
      },
      async execute(args) {
        const inst = instancePath()
        if (!inst) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        await savesService.deleteSave({ instancePath: inst, saveName })
        return { ok: true, deleted: saveName }
      },
    },
    {
      name: 'link_world_as_server',
      description: 'Link a singleplayer world as the dedicated-server world for the current instance, so launching the local server runs that world. `saveName` is the world folder name. Pair this with the `server` pack to run the server.',
      parameters: {
        type: 'object',
        properties: {
          saveName: { type: 'string', description: 'World folder name to use as the server world' },
        },
        required: ['saveName'],
      },
      async execute(args) {
        const inst = instancePath()
        if (!inst) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        await savesService.linkSaveAsServerWorld({ instancePath: inst, saveName })
        return { ok: true, linked: saveName }
      },
    },
  ]
}
