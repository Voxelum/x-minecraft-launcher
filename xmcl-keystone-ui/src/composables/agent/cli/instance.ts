import type { PartialRuntimeVersions } from '@xmcl/instance'
import type { InstanceService, ModpackService } from '@xmcl/runtime-api'
import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const INSTANCE_USAGE = 'instance <list|select|change> ...'
export const INSTANCE_ADMIN_USAGE = 'instance <create|duplicate|delete|import> ...'

export interface InstanceAdminOperations {
  create(options: { name: string; description?: string; runtime?: PartialRuntimeVersions }): Promise<unknown>
  duplicate(path?: string): Promise<unknown>
  delete(path?: string, deleteData?: boolean): Promise<unknown>
  importModpack(path: string): Promise<unknown>
}

export function createInstanceAdminOperations(cli: CliContext, services: {
  instanceService: Pick<InstanceService, 'createInstance' | 'duplicateInstance' | 'deleteInstance'>
  modpackService: Pick<ModpackService, 'importModpack'>
}): InstanceAdminOperations {
  return {
    async create(options) {
      const path = await services.instanceService.createInstance({
        name: options.name,
        ...(options.description ? { description: options.description } : {}),
        ...(options.runtime ? { runtime: options.runtime } : {}),
      })
      cli.ctx.selectedInstancePath.value = path
      return { ok: true, path, selected: true }
    },
    async duplicate(path) {
      const source = path ?? cli.ctx.instance.value.path
      if (!source) return { error: 'no instance selected' }
      const duplicated = await services.instanceService.duplicateInstance(source)
      cli.ctx.selectedInstancePath.value = duplicated
      return { ok: true, path: duplicated, from: source, selected: true }
    },
    async delete(path, deleteData = false) {
      const target = path ?? cli.ctx.instance.value.path
      if (!target) return { error: 'no instance selected' }
      const approved = await cli.ctx.interceptDelete?.({ instancePath: target, paths: [`instance:${target}`] })
      if (approved === false) return { cancelled: true, path: target }
      await services.instanceService.deleteInstance(target, deleteData)
      return { ok: true, deleted: target, deletedData: deleteData }
    },
    async importModpack(path) {
      const result = await services.modpackService.importModpack(path)
      if (result?.instancePath) cli.ctx.selectedInstancePath.value = result.instancePath
      return { ok: true, path: result?.instancePath, runtime: result?.runtime, version: result?.version, selected: true }
    },
  }
}

export function createInstanceCommand(cli: CliContext, admin?: InstanceAdminOperations): VirtualCliCommand {
  const usage = admin ? `${INSTANCE_USAGE}\n       ${INSTANCE_ADMIN_USAGE}` : INSTANCE_USAGE
  return {
    name: 'instance',
    usage,
    description: admin ? 'Manage instances and atomically apply accumulated instance file changes.' : 'Review and atomically apply accumulated instance file changes.',
    help: [
      '`instance list` lists known instances with their paths, runtime, Java, server, and play information.',
      '`instance select <path>` switches the currently selected instance. Quote paths containing spaces.',
      '`instance change status` shows the accumulated change list and install preview.',
      '`instance change apply` applies all accumulated mod, resourcepack, and shaderpack changes in one installation.',
      '`instance change reset` discards the change list.',
      ...(admin ? [
        '`instance create <name> [--description <text>] [--minecraft <version>] [--forge <version>|--neoforge <version>|--fabric <version>|--quilt <version>|--optifine <version>]` creates and selects an instance.',
        '`instance duplicate [path]` duplicates an instance and selects the copy; defaults to the current instance.',
        '`instance delete [path] [--delete-data]` permanently deletes an instance; confirmation is required.',
        '`instance import <absoluteModpackPath>` imports a CurseForge, Modrinth, or MCBBS modpack and selects the new instance.',
        'Use `version list ...` first and pass returned version values verbatim. Quote names, descriptions, or paths containing spaces.',
      ] : []),
    ],
    execute: async (argv) => {
      if (argv[0] === 'list') {
        if (argv.length !== 1) return usageError(usage, 'instance list accepts no arguments.')
        return cli.ctx.instances.value.map((instance) => ({
          path: instance.path,
          name: instance.name,
          runtime: instance.runtime,
          version: instance.version,
          java: instance.java,
          server: instance.server,
          description: instance.description,
          lastPlayed: instance.lastPlayedDate,
          playtime: instance.playtime,
          selected: instance.path === cli.ctx.selectedInstancePath.value,
        }))
      }
      if (argv[0] === 'select') {
        if (argv.length !== 2) return usageError(usage, 'instance select requires one instance path.')
        const path = argv[1]
        if (!cli.ctx.instances.value.some((instance) => instance.path === path)) return { error: `instance not found: ${path}` }
        cli.ctx.selectedInstancePath.value = path
        return { ok: true, path }
      }
      if (argv[0] === 'change') {
        if (argv.length !== 2) return usageError(usage, 'Invalid instance change command.')
        if (argv[1] === 'status') return cli.ctx.instanceChanges.status()
        if (argv[1] === 'apply') return cli.ctx.instanceChanges.apply()
        if (argv[1] === 'reset') return cli.ctx.instanceChanges.reset()
        return usageError(usage, `Unknown instance change operation: ${argv[1]}`)
      }
      if (!admin) return usageError(usage, 'Load the `instance_admin` pack to manage instances.')
      const [action, ...args] = argv
      if (action === 'duplicate') {
        if (args.length > 1) return usageError(usage, 'instance duplicate accepts at most one path.')
        return admin.duplicate(args[0])
      }
      if (action === 'delete') {
        const deleteData = args.includes('--delete-data')
        const paths = args.filter((arg) => arg !== '--delete-data')
        if (paths.length > 1) return usageError(usage, 'instance delete accepts at most one path.')
        return admin.delete(paths[0], deleteData)
      }
      if (action === 'import') {
        if (args.length !== 1) return usageError(usage, 'instance import requires one absolute modpack path.')
        return admin.importModpack(args[0])
      }
      if (action !== 'create') return usageError(usage, `Unknown instance operation: ${action ?? ''}`)

      const name = args[0]?.trim()
      if (!name || name.startsWith('--')) return usageError(usage, 'instance create requires a name.')
      const runtime: Partial<PartialRuntimeVersions> = {}
      let description: string | undefined
      const loaders = new Set<string>()
      for (let index = 1; index < args.length; index++) {
        const option = args[index]
        if (option === '--description') {
          description = args[++index]
          if (!description || description.startsWith('--')) return usageError(usage, '--description requires a value.')
          continue
        }
        const fields = {
          '--minecraft': 'minecraft',
          '--forge': 'forge',
          '--neoforge': 'neoForged',
          '--fabric': 'fabricLoader',
          '--quilt': 'quiltLoader',
          '--optifine': 'optifine',
        } as const
        const field = fields[option as keyof typeof fields]
        if (!field) return usageError(usage, `Unknown instance create option: ${option}`)
        const value = args[++index]
        if (!value || value.startsWith('--')) return usageError(usage, `${option} requires a value.`)
        if (runtime[field]) return usageError(usage, `Repeated ${option} option.`)
        runtime[field] = value
        if (field !== 'minecraft' && field !== 'optifine') loaders.add(field)
      }
      if (loaders.size > 1) return usageError(usage, 'Use exactly one mod loader when creating an instance.')
      if (Object.keys(runtime).length && !runtime.minecraft) return usageError(usage, '--minecraft is required when specifying runtime options.')
      return admin.create({ name, description, ...(Object.keys(runtime).length ? { runtime: runtime as PartialRuntimeVersions } : {}) })
    },
  }
}
