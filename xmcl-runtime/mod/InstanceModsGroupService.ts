import { InstanceModsGroupService as IInstanceModsGroupService, InstanceModsGroupState, InstanceGroupStateKey, InstanceModsGroupServiceKey, ModGroupRules, SharedState, ModGroupData } from '@xmcl/runtime-api'
import { FSWatcher } from 'chokidar'
import { ensureFile, pathExists, readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { AnyError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'

/**
 * Provide services to manage mod groups and shared group rules
 */
@ExposeServiceKey(InstanceModsGroupServiceKey)
export class InstanceModsGroupService extends AbstractService implements IInstanceModsGroupService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  /**
   * Get the shared state object for mod groups in an instance
   * @param instancePath The instance path
   */
  async getGroupState(instancePath: string): Promise<SharedState<InstanceModsGroupState>> {
    if (!instancePath) throw new AnyError('GetGroupStateError', 'Cannot get group state on empty path')

    const stateManager = await this.app.registry.get(ServiceStateManager)

    return stateManager.registerOrGet(InstanceGroupStateKey(instancePath), async () => {
      const state = new InstanceModsGroupState()

      const groupsPath = join(instancePath, 'mod-groups.json')

      const watcher = new FSWatcher()
      watcher.add(groupsPath)
      watcher.on('all', async (e) => {
        if (e === 'add' || e === 'change') {
          const data = await readFile(groupsPath, 'utf-8')
          const groups = JSON.parse(data)
          if (typeof groups === 'object') {
            state.groupsSet(groups)
          }
        } else {
          state.groupsSet({})
        }
      })

      const dispose = () => {
        watcher.close()
      }

      return [state, dispose]
    })
  }

  /**
   * Update all mod group assignments for an instance
   * @param instancePath The instance path
   * @param groups Object mapping group names to arrays of mod hashes
   */
  async updateModsGroups(instancePath: string, groups: Record<string, ModGroupData>): Promise<void> {
    const groupState = await this.getGroupState(instancePath)
    const groupsPath = join(instancePath, 'mod-groups.json')

    // Update all groups at once
    groupState.groupsSet(groups)
    try {
      await ensureFile(groupsPath)
      await writeFile(groupsPath, JSON.stringify(groups, null, 2), 'utf-8')
    } catch (e) {
      this.warn(`Failed to save mod groups to ${groupsPath}`, e)
    }

    this.log(`Updated mod groups for instance ${instancePath} with ${Object.keys(groups).length} groups`)
  }

  /**
   * Get the shared group rules that map mod IDs to group names
   * These rules can be applied across all instances
   */
  async getSharedGroupRules(): Promise<ModGroupRules> {
    const appDataPath = this.app.appDataPath
    const rulesPath = join(appDataPath, 'shared-mod-group-rules.json')

    try {
      if (await pathExists(rulesPath)) {
        const data = await readFile(rulesPath, 'utf-8')
        const rules = JSON.parse(data)
        return rules
      }
    } catch (e) {
      this.warn(`Failed to load shared group rules from ${rulesPath}`, e)
    }

    return {}
  }

  /**
   * Update shared group rules by extracting mod ID to group mappings from an instance
   * @param instancePath Path to the instance to extract rules from
   */
  async updateSharedGroupRules(groupRules: Record<string, string[]>): Promise<void> {
    const appDataPath = this.app.appDataPath
    const rulesPath = join(appDataPath, 'shared-mod-group-rules.json')

    // Get existing shared rules
    const sharedRules = await this.getSharedGroupRules()
    const newRules = {} as ModGroupRules

    const visited = new Set<string>()

    for (const [key, modIds] of Object.entries(groupRules)) {
      if (!newRules[key]) {
        newRules[key] = []
      }

      for (const modId of modIds) {
        if (!newRules[key].includes(modId)) {
          newRules[key].push(modId)
        }
        visited.add(modId)
      }
    }

    for (const [key, modIds] of Object.entries(sharedRules)) {
      if (!newRules[key]) {
        newRules[key] = []
      }

      for (const modId of modIds) {
        if (visited.has(modId)) {
          continue
        }
        if (!newRules[key].includes(modId)) {
          newRules[key].push(modId)
        }
        visited.add(modId)
      }
    }

    // Save to file
    try {
      await ensureFile(rulesPath)
      await writeFile(rulesPath, JSON.stringify(newRules, null, 2), 'utf-8')
      this.log(`Updated shared group rules with ${Object.keys(newRules).length} new or changed mod ID mappings`)
    } catch (e) {
      this.warn(`Failed to save shared group rules to ${rulesPath}`, e)
      throw new AnyError('UpdateSharedGroupRulesError', `Failed to save shared group rules: ${e}`)
    }
  }
}