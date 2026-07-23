import { getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { getInstanceFileFromModrinthVersion } from '@/util/modrinth'
import { getModDependencyIdentity, deduplicateModDependencyInstallations } from '../../modDependencyInstall'
import type { useModDependenciesCheck } from '../../modDependenciesCheck'
import type { useModLibCleaner } from '../../modLibCleaner'
import type { useModUpgrade } from '../../modUpgrade'
import type { InstanceChangeOperations } from '../instanceChanges'
import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const MODS_USAGE = 'mods <deps check|unused scan|unused disable|updates check> [options]'

const UPDATE_POLICIES = ['modrinth', 'curseforge', 'modrinthOnly', 'curseforgeOnly'] as const
type UpdatePolicy = typeof UPDATE_POLICIES[number]

type DependencyCheck = Pick<ReturnType<typeof useModDependenciesCheck>, 'refresh' | 'installation' | 'error'>
type LibCleaner = Pick<ReturnType<typeof useModLibCleaner>, 'refresh' | 'unusedMods' | 'error'>
type ModUpgrade = Pick<ReturnType<typeof useModUpgrade>, 'refresh' | 'plans' | 'error' | 'skipVersion' | 'upgradePolicy'>

export interface ModsCliOperations {
  checkDependencies(): Promise<unknown>
  scanUnused(): Promise<unknown>
  disableUnused(): Promise<unknown>
  checkUpdates(options: { policy?: string; skipVersion?: boolean }): Promise<unknown>
}

export function createModsCliOperations(options: {
  currentInstancePath: () => string | undefined
  dependencyCheck: DependencyCheck
  libCleaner: LibCleaner
  modUpgrade: ModUpgrade
  instanceChanges: InstanceChangeOperations
}): ModsCliOperations {
  const { currentInstancePath, dependencyCheck, libCleaner, modUpgrade, instanceChanges } = options

  async function checkDependencies() {
    await dependencyCheck.refresh()
    const rawInstallations = dependencyCheck.installation.value
    const byDependency = new Map<string, Array<{ file: string; requiredBy: string }>>()
    for (const [file, mod] of rawInstallations) {
      const identity = getModDependencyIdentity(file)
      const candidates = byDependency.get(identity) ?? []
      candidates.push({ file: file.path, requiredBy: mod.name || mod.fileName })
      byDependency.set(identity, candidates)
    }
    const missing = deduplicateModDependencyInstallations(rawInstallations).map(([file, mod]) => ({
      file: file.path,
      requiredBy: mod.name || mod.fileName,
    }))
    const conflicts = [...byDependency.entries()]
      .map(([dependency, candidates]) => ({ dependency, candidates }))
      .filter(({ candidates }) => new Set(candidates.map((candidate) => candidate.file)).size > 1)
    const error = dependencyCheck.error.value
    const result = {
      missing,
      ...(conflicts.length ? { conflicts } : {}),
      ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
    }
    if (!missing.length) return result
    const change = await instanceChanges.add({
      label: 'missing mod dependencies',
      oldFiles: [],
      files: deduplicateModDependencyInstallations(rawInstallations).map(([file]) => file),
    })
    return { ...result, change }
  }

  async function scanUnused() {
    await libCleaner.refresh()
    const unused = libCleaner.unusedMods.value.map((file) => ({ path: file.path }))
    const error = libCleaner.error.value
    return { unused, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
  }

  async function disableUnused() {
    if (!currentInstancePath()) return { error: 'no instance selected' }
    const oldFiles = libCleaner.unusedMods.value
    if (!oldFiles.length) return { disabled: 0, note: 'No unused library mods. Run `bash mods unused scan` first.' }
    const files = oldFiles.map((file) => ({ ...file, path: file.path + '.disabled' }))
    return instanceChanges.add({ label: 'disable unused library mods', oldFiles, files })
  }

  function normalizeUpgradePolicy(policy?: string): UpdatePolicy {
    const candidate = policy ?? String(modUpgrade.upgradePolicy.value)
    return UPDATE_POLICIES.includes(candidate as UpdatePolicy) ? candidate as UpdatePolicy : 'modrinth'
  }

  async function checkUpdates(options: { policy?: string; skipVersion?: boolean }) {
    const policy = normalizeUpgradePolicy(options.policy)
    const skipVersion = options.skipVersion ?? modUpgrade.skipVersion.value
    await modUpgrade.refresh({ policy, skipVersion })
    const updates = Object.values(modUpgrade.plans.value).map((plan) => ({
      mod: plan.mod.name || plan.mod.fileName,
      from: plan.mod.version,
      to: 'version' in plan ? (plan.version.version_number || plan.version.name) : (plan.file.displayName || plan.file.fileName),
      source: 'version' in plan ? 'modrinth' : 'curseforge',
    }))
    const error = modUpgrade.error.value
    if (!updates.length) return { updates, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
    const plans = Object.values(modUpgrade.plans.value)
    const oldFiles = plans.map((plan) => ({
      path: `mods/${plan.mod.fileName}`,
      hashes: { sha1: plan.mod.hash },
      size: plan.mod.size || 0,
    }))
    const files = plans.map((plan) => 'file' in plan
      ? getInstanceFileFromCurseforgeFile(plan.file)
      : getInstanceFileFromModrinthVersion(plan.version))
    const change = await instanceChanges.add({ label: 'mod updates', oldFiles, files })
    return { updates, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}), change }
  }

  return { checkDependencies, scanUnused, disableUnused, checkUpdates }
}

export function createModsCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'mods',
    usage: MODS_USAGE,
    description: 'Check and maintain mod dependencies, orphan libraries, and updates.',
    help: [
      '`mods deps check` finds missing required dependencies and adds them to the instance change list.',
      '`mods unused scan` finds orphan library mods; `mods unused disable` adds disabling them to the change list without deleting files.',
      '`mods updates check [--policy <modrinth|curseforge|modrinthOnly|curseforgeOnly>] [--skip-version]` finds compatible updates and adds them to the change list.',
      'Accumulate any number of changes, inspect them with `instance change status`, then run `instance change apply` once.',
    ],
    execute: async (argv) => {
      const [group, action, ...options] = argv
      if (group === 'deps' && action === 'check' && options.length === 0) return cli.ctx.modMaintenance.checkDependencies()
      if (group === 'unused' && action === 'scan' && options.length === 0) return cli.ctx.modMaintenance.scanUnused()
      if (group === 'unused' && action === 'disable' && options.length === 0) return cli.ctx.modMaintenance.disableUnused()
      if (group !== 'updates' || action !== 'check') return usageError(MODS_USAGE, 'Unknown mods operation or invalid arguments.')

      let policy: string | undefined
      let skipVersion: boolean | undefined
      for (let i = 0; i < options.length; i++) {
        const option = options[i]
        if (option === '--policy') {
          const value = options[++i]
          if (!value || !UPDATE_POLICIES.includes(value as typeof UPDATE_POLICIES[number])) {
            return usageError(MODS_USAGE, 'Invalid or missing --policy value.')
          }
          if (policy !== undefined) return usageError(MODS_USAGE, 'Repeated --policy option.')
          policy = value
        } else if (option === '--skip-version') {
          if (skipVersion !== undefined) return usageError(MODS_USAGE, 'Repeated --skip-version option.')
          skipVersion = true
        } else {
          return usageError(MODS_USAGE, `Unknown mods updates option: ${option}`)
        }
      }
      return cli.ctx.modMaintenance.checkUpdates({ policy, skipVersion })
    },
  }
}
