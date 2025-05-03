import { SharedState } from '../util/SharedState'
import { ServiceKey } from './Service'

export interface ModGroupData {
  color: string
  files: string[]
}

export class InstanceModsGroupState {
  groups: Record<string, ModGroupData> = {}

  groupsSet(groups: Record<string, ModGroupData>) {
    this.groups = groups
  }
}

/**
 * Group mod id by group name
 */
export interface ModGroupRules extends Record<string, string[]> {
}

/**
 * Function to get the instance group state key
 */
export function InstanceGroupStateKey(path: string) {
  return 'instance-mods-group-state://' + path
}

/**
 * Key for accessing the shared group rules
 */
export const SharedGroupRulesKey = 'shared-mod-group-rules'

/**
 * Service to manage mod groups within instances and import/export modlists with group information
 */
export interface InstanceModsGroupService {
  /**
   * Get the shared state object for mod groups in an instance
   * @param instancePath The instance path
   */
  getGroupState(instancePath: string): Promise<SharedState<InstanceModsGroupState>>

  /**
   * Update all mod group assignments for an instance
   * @param instancePath The instance path
   * @param groups Object mapping group names to arrays of mod hashes
   */
  updateModsGroups(instancePath: string, groups: Record<string, ModGroupData>): Promise<void>
  
  /**
   * Get the shared group rules that map mod IDs to group names
   * These rules can be applied across all instances
   */
  getSharedGroupRules(): Promise<ModGroupRules>
  
  /**
   * Update shared group rules by extracting mod ID to group mappings from an instance
   * @param instancePath Path to the instance to extract rules from
   */
  updateSharedGroupRules(mapping: ModGroupRules): Promise<void>
}

export const InstanceModsGroupServiceKey: ServiceKey<InstanceModsGroupService> = 'InstanceModsGroupService'