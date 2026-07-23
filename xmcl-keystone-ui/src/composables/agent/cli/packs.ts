import { getInstanceFileFromCurseforgeFile } from '@/util/curseforge'
import { getInstanceFileFromModrinthVersion } from '@/util/modrinth'
import type { useModUpgrade } from '../../modUpgrade'
import type { InstanceChangeOperations } from '../instanceChanges'
import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

const UPDATE_POLICIES = ['modrinth', 'curseforge', 'modrinthOnly', 'curseforgeOnly'] as const
type UpdatePolicy = typeof UPDATE_POLICIES[number]
export type PackKind = 'resourcepacks' | 'shaderpacks'
type UpgradeSource = Pick<ReturnType<typeof useModUpgrade>, 'refresh' | 'plans' | 'error' | 'skipVersion' | 'upgradePolicy'>

export interface PackUpdateOperations {
  check(options: { policy?: string; skipVersion?: boolean }): Promise<unknown>
}

export function createPackUpdateOperations(options: {
  kind: PackKind
  currentInstancePath: () => string | undefined
  upgrade: UpgradeSource
  instanceChanges: InstanceChangeOperations
}): PackUpdateOperations {
  const { kind, currentInstancePath, upgrade, instanceChanges } = options

  function normalizePolicy(policy?: string): UpdatePolicy {
    const candidate = policy ?? String(upgrade.upgradePolicy.value)
    return UPDATE_POLICIES.includes(candidate as UpdatePolicy) ? candidate as UpdatePolicy : 'modrinth'
  }

  async function check(checkOptions: { policy?: string; skipVersion?: boolean }) {
    if (!currentInstancePath()) return { error: 'no instance selected' }
    const policy = normalizePolicy(checkOptions.policy)
    const skipVersion = checkOptions.skipVersion ?? upgrade.skipVersion.value
    await upgrade.refresh({ policy, skipVersion })
    const plans = Object.values(upgrade.plans.value)
    const updates = plans.map((plan) => ({
      file: plan.mod.name || plan.mod.fileName,
      from: plan.mod.version,
      to: 'version' in plan ? (plan.version.version_number || plan.version.name) : (plan.file.displayName || plan.file.fileName),
      source: 'version' in plan ? 'modrinth' : 'curseforge',
    }))
    const error = upgrade.error.value
    const result = { updates, ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}) }
    if (!plans.length) return result

    const oldFiles = plans.map((plan) => ({
      path: `${kind}/${plan.mod.fileName}`,
      hashes: { sha1: plan.mod.hash },
      size: plan.mod.size || 0,
    }))
    const files = plans.map((plan) => 'file' in plan
      ? getInstanceFileFromCurseforgeFile(plan.file, kind)
      : getInstanceFileFromModrinthVersion(plan.version, kind))
    const change = await instanceChanges.add({ label: `${kind} updates`, oldFiles, files })
    return { ...result, change }
  }

  return { check }
}

export function createPackCommand(cli: CliContext, kind: PackKind): VirtualCliCommand {
  const usage = `${kind} updates check [--policy <modrinth|curseforge|modrinthOnly|curseforgeOnly>] [--skip-version]`
  return {
    name: kind,
    usage,
    description: `Check ${kind} for compatible updates and add them to the instance change list.`,
    help: [
      `\`${kind} updates check\` checks installed ${kind} against Modrinth and CurseForge.`,
      '`--policy` controls provider priority or restricts the check to one provider.',
      '`--skip-version` skips installed packs whose current release targets a different Minecraft version.',
      'Available updates are added to the shared change list. Inspect with `instance change status`, then run `instance change apply`.',
    ],
    execute: async (argv) => {
      const [group, action, ...options] = argv
      if (group !== 'updates' || action !== 'check') return usageError(usage, `Unknown ${kind} operation or invalid arguments.`)

      let policy: string | undefined
      let skipVersion: boolean | undefined
      for (let i = 0; i < options.length; i++) {
        const option = options[i]
        if (option === '--policy') {
          const value = options[++i]
          if (!value || !UPDATE_POLICIES.includes(value as UpdatePolicy)) return usageError(usage, 'Invalid or missing --policy value.')
          if (policy !== undefined) return usageError(usage, 'Repeated --policy option.')
          policy = value
        } else if (option === '--skip-version') {
          if (skipVersion !== undefined) return usageError(usage, 'Repeated --skip-version option.')
          skipVersion = true
        } else {
          return usageError(usage, `Unknown ${kind} updates option: ${option}`)
        }
      }
      return cli.ctx.packUpdates[kind].check({ policy, skipVersion })
    },
  }
}
