import type { PartialRuntimeVersions } from '@xmcl/instance'
import type { InstanceSavesService, InstanceService, ModpackService } from '@xmcl/runtime-api'
import { requestAgentConfirmation } from './confirm'
import type { AgentCapabilityContext } from './capabilityContext'
import { createAgentTools } from './toolSupport'

export interface AgentManagementServices {
  instanceService: Pick<InstanceService, 'createInstance' | 'duplicateInstance' | 'deleteInstance'>
  modpackService: Pick<ModpackService, 'importModpack'>
  savesService: Pick<InstanceSavesService, 'importSave' | 'exportSave' | 'cloneSave' | 'deleteSave' | 'linkSaveAsServerWorld'>
}

async function confirmAction(title: string, message: string, details: string[], destructive = false) {
  const accepted = await requestAgentConfirmation({
    action: 'confirm',
    title,
    message,
    details,
    destructive,
    confirmLabel: destructive ? 'Delete' : 'Continue',
  })
  if (!accepted) throw new Error('User declined the action')
}

function compatibilityLabel(compatible: number | undefined) {
  if (compatible === undefined) return 'unknown'
  if (compatible === 0) return 'matched'
  if (compatible === 1) return 'may-incompatible'
  if (compatible === 2) return 'very-likely-incompatible'
  return String(compatible)
}

export function createAgentManagementTools(
  context: AgentCapabilityContext,
  services: AgentManagementServices,
) {
  const instancePath = () => context.instance.value.path || undefined
  const findSave = (name: string) => context.saves.value.find(save => save.name === name || save.path === name)

  return createAgentTools([
    {
      name: 'list_accounts',
      label: 'List accounts',
      readonly: true,
      description: 'List accounts already logged into the launcher. This never exposes passwords or tokens.',
      parameters: { type: 'object', properties: {} },
      execute() {
        const active = context.userProfile.value?.id
        return context.accounts.value.map(user => ({
          id: user.id,
          username: user.username,
          authority: user.authority,
          profile: user.profiles?.[user.selectedProfile]?.name,
          expired: user.invalidated || user.expiredAt < Date.now(),
          active: user.id === active,
        }))
      },
    },
    {
      name: 'select_account',
      label: 'Select account',
      description: 'Select an existing logged-in account by id. It cannot log out or remove accounts.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      execute(args) {
        const id = String(args.id ?? '')
        const found = context.accounts.value.find(user => user.id === id)
        if (!found) return { error: `account not found: ${id}` }
        context.selectAccount(id)
        return { ok: true, id, username: found.username }
      },
    },
    {
      name: 'diagnose_java',
      label: 'Diagnose Java',
      readonly: true,
      description: 'Report the selected Java runtime, required major version, compatibility, and known runtimes.',
      parameters: { type: 'object', properties: {} },
      execute() {
        const status = context.javaStatus.value
        if (!status) return { available: false, note: 'Java status is not available yet.' }
        const selected = status.java
        return {
          available: true,
          issue: context.javaIssue.value ?? 'none',
          noJavaFound: !!status.noJava,
          requiredMajorVersion: status.javaVersion?.majorVersion,
          compatibility: compatibilityLabel(status.compatible),
          selectedJava: selected
            ? { path: selected.path, version: selected.version, majorVersion: selected.majorVersion, valid: selected.valid }
            : null,
          installedJavas: context.javaList.value.map(java => ({
            path: java.path,
            version: java.version,
            majorVersion: java.majorVersion,
            valid: java.valid,
          })),
        }
      },
    },
    {
      name: 'install_java',
      label: 'Install Java',
      description: 'Install the Java runtime required by the selected instance.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        await confirmAction('Install Java', 'Install a compatible Java runtime for the selected instance?', [context.instance.value.name])
        return context.installJava()
      },
    },
    {
      name: 'check_mod_dependencies',
      label: 'Check mod dependencies',
      readonly: true,
      description: 'Find missing required dependencies of installed mods.',
      parameters: { type: 'object', properties: {} },
      execute: () => context.checkModDependencies(),
    },
    {
      name: 'install_mod_dependencies',
      label: 'Install mod dependencies',
      description: 'Install dependencies found by check_mod_dependencies.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        await confirmAction('Install mod dependencies', 'Install the missing required mod dependencies?', [context.instance.value.name])
        return context.installModDependencies()
      },
    },
    {
      name: 'scan_unused_mods',
      label: 'Scan unused mods',
      readonly: true,
      description: 'Find installed library mods that no enabled mod depends on.',
      parameters: { type: 'object', properties: {} },
      execute: () => context.scanUnusedMods(),
    },
    {
      name: 'disable_unused_mods',
      label: 'Disable unused mods',
      description: 'Disable unused library mods found by scan_unused_mods.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        await confirmAction('Disable unused mods', 'Disable the unused library mods?', [context.instance.value.name])
        return context.disableUnusedMods()
      },
    },
    {
      name: 'check_mod_updates',
      label: 'Check mod updates',
      readonly: true,
      description: 'Check Modrinth and CurseForge for compatible mod updates.',
      parameters: {
        type: 'object',
        properties: {
          policy: { type: 'string', enum: ['modrinth', 'curseforge', 'modrinthOnly', 'curseforgeOnly'] },
          skipVersion: { type: 'boolean' },
        },
      },
      execute: args => context.checkModUpdates({
        policy: args.policy === undefined ? undefined : String(args.policy),
        skipVersion: args.skipVersion === undefined ? undefined : !!args.skipVersion,
      }),
    },
    {
      name: 'apply_mod_updates',
      label: 'Apply mod updates',
      description: 'Apply updates found by check_mod_updates.',
      parameters: { type: 'object', properties: {} },
      async execute() {
        await confirmAction('Update mods', 'Apply the available compatible mod updates?', [context.instance.value.name])
        return context.applyModUpdates()
      },
    },
    {
      name: 'list_worlds',
      label: 'List worlds',
      readonly: true,
      description: 'List worlds in the selected instance.',
      parameters: { type: 'object', properties: {} },
      execute() {
        if (!instancePath()) return { error: 'no instance selected' }
        return context.saves.value.map(save => ({
          saveName: save.name,
          levelName: save.levelName,
          gameVersion: save.gameVersion,
          lastPlayed: save.lastPlayed,
          path: save.path,
        }))
      },
    },
    {
      name: 'import_world',
      label: 'Import world',
      description: 'Import a world from an absolute zip or folder path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          saveName: { type: 'string' },
        },
        required: ['path'],
      },
      async execute(args) {
        const current = instancePath()
        if (!current) return { error: 'no instance selected' }
        const path = String(args.path ?? '')
        if (!path) return { error: 'path is required' }
        await confirmAction('Import world', 'Import this world into the selected instance?', [path])
        const importedPath = await services.savesService.importSave({
          instancePath: current,
          path,
          saveName: args.saveName ? String(args.saveName) : undefined,
        })
        return { ok: true, importedPath }
      },
    },
    {
      name: 'export_world',
      label: 'Export world',
      description: 'Export a world to an absolute destination path.',
      parameters: {
        type: 'object',
        properties: {
          saveName: { type: 'string' },
          destination: { type: 'string' },
          zip: { type: 'boolean' },
        },
        required: ['saveName', 'destination'],
      },
      async execute(args) {
        const current = instancePath()
        if (!current) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        const destination = String(args.destination ?? '')
        if (!destination) return { error: 'destination is required' }
        await services.savesService.exportSave({
          instancePath: current,
          saveName,
          destination,
          zip: args.zip === undefined ? true : !!args.zip,
        })
        return { ok: true, saveName, destination }
      },
    },
    {
      name: 'clone_world',
      label: 'Clone world',
      description: 'Clone a world inside this instance or into another instance.',
      parameters: {
        type: 'object',
        properties: {
          saveName: { type: 'string' },
          newSaveName: { type: 'string' },
          destInstancePath: { type: 'string' },
        },
        required: ['saveName'],
      },
      async execute(args) {
        const current = instancePath()
        if (!current) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        await services.savesService.cloneSave({
          srcInstancePath: current,
          destInstancePath: args.destInstancePath ? String(args.destInstancePath) : current,
          saveName,
          newSaveName: args.newSaveName ? String(args.newSaveName) : undefined,
        })
        return { ok: true, saveName, newSaveName: args.newSaveName }
      },
    },
    {
      name: 'delete_world',
      label: 'Delete world',
      description: 'Permanently delete a world from the selected instance.',
      parameters: {
        type: 'object',
        properties: { saveName: { type: 'string' } },
        required: ['saveName'],
      },
      async execute(args) {
        const current = instancePath()
        if (!current) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        await confirmAction('Delete world', `Delete world "${saveName}" permanently?`, [current], true)
        await services.savesService.deleteSave({ instancePath: current, saveName })
        return { ok: true, deleted: saveName }
      },
    },
    {
      name: 'link_world_as_server',
      label: 'Link server world',
      description: 'Link a singleplayer world as the dedicated server world.',
      parameters: {
        type: 'object',
        properties: { saveName: { type: 'string' } },
        required: ['saveName'],
      },
      async execute(args) {
        const current = instancePath()
        if (!current) return { error: 'no instance selected' }
        const saveName = String(args.saveName ?? '')
        if (!findSave(saveName)) return { error: `world not found: ${saveName}` }
        await services.savesService.linkSaveAsServerWorld({ instancePath: current, saveName })
        return { ok: true, linked: saveName }
      },
    },
    {
      name: 'create_instance',
      label: 'Create instance',
      description: 'Create a new instance with an optional runtime. The current run remains scoped to the original instance.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          runtime: { type: 'object' },
        },
        required: ['name'],
      },
      async execute(args) {
        const name = String(args.name ?? '').trim()
        if (!name) return { error: 'name is required' }
        const runtime = args.runtime && typeof args.runtime === 'object' && !Array.isArray(args.runtime)
          ? args.runtime as PartialRuntimeVersions
          : undefined
        const path = await services.instanceService.createInstance({
          name,
          ...(args.description ? { description: String(args.description) } : {}),
          ...(runtime ? { runtime } : {}),
        })
        return { ok: true, path, selected: false }
      },
    },
    {
      name: 'duplicate_instance',
      label: 'Duplicate instance',
      description: 'Duplicate an instance. The current run remains scoped to the original instance.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
      async execute(args) {
        const source = String(args.path ?? instancePath() ?? '')
        if (!source) return { error: 'no instance selected' }
        await confirmAction('Duplicate instance', 'Duplicate this instance and its content?', [source])
        const path = await services.instanceService.duplicateInstance(source)
        return { ok: true, path, from: source, selected: false }
      },
    },
    {
      name: 'delete_instance',
      label: 'Delete instance',
      description: 'Permanently delete an instance, optionally including its data files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          deleteData: { type: 'boolean' },
        },
      },
      async execute(args) {
        const target = String(args.path ?? instancePath() ?? '')
        if (!target) return { error: 'no instance selected' }
        await confirmAction('Delete instance', 'Delete this instance permanently?', [target], true)
        await services.instanceService.deleteInstance(target, !!args.deleteData)
        return { ok: true, deleted: target, deletedData: !!args.deleteData }
      },
    },
    {
      name: 'import_modpack',
      label: 'Import modpack',
      description: 'Import a local CurseForge, Modrinth, or MCBBS modpack file as a new instance without changing the current run scope.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      async execute(args) {
        const modpackPath = String(args.path ?? '')
        if (!modpackPath) return { error: 'path is required' }
        await confirmAction('Import modpack', 'Import this modpack as a new instance?', [modpackPath])
        const result = await services.modpackService.importModpack(modpackPath)
        return {
          ok: true,
          path: result?.instancePath,
          runtime: result?.runtime,
          version: result?.version,
          selected: false,
        }
      },
    },
  ])
}
