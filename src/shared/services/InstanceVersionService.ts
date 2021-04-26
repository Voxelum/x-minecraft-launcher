import { DEFAULT_PROFILE } from '../entities/instance'
import { getResolvedVersion } from '../entities/version'
import { InstanceState } from './InstanceService'
import { ServiceKey, State, StatefulService } from './Service'
import { VersionState } from './VersionService'

export interface InstanceVersionState extends State { }
export class InstanceVersionState {
  constructor(private instance: InstanceState, private version: VersionState) { }
  /**
   * The selected instance mapped local version.
   * If there is no local version matced, it will return a local version with id equal to `""`.
   */
  get instanceVersion() {
    const current = this.instance.all[this.instance.path] || DEFAULT_PROFILE
    return getResolvedVersion(this.version.local, current.runtime, current.version)
  }
}

/**
 */
export interface InstanceVersionService extends StatefulService<InstanceVersionState> {
}

export const InstanceVersionServiceKey: ServiceKey<InstanceVersionService> = 'InstanceVersionService'
