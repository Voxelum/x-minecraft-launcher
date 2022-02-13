import { ServiceKey, State, StatefulService } from './Service'

export interface ImportHMCLModpackOptions {
  /**
   * The path of HMCL modpack zip file
   */
  path: string
}

export interface CreateManagedInstanceOptions {
  type: Omit<InstanceManagerType, InstanceManagerType.None>
  data: object
}

export enum InstanceManagerType {
  None,
  Mcbbs,
  HMCL,
  ForgeServer,
}

export class InstanceManagingState {
  type: InstanceManagerType = InstanceManagerType.None

  data: object | undefined = undefined

  get HMCLModpackMetadata() {
    if (this.type !== InstanceManagerType.HMCL) {
      return undefined
    }
  }

  get mcbbsModpackMetadata() {
    if (this.type !== InstanceManagerType.Mcbbs) {
      return undefined
    }
  }

  get forgeServerMetadata() {
    if (this.type !== InstanceManagerType.ForgeServer) {
      return undefined
    }
  }
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export interface InstanceManagingService extends StatefulService<InstanceManagingState> {
  /**
   * Create a managed instance
   * @param options
   */
  createManagedInstance(options: CreateManagedInstanceOptions): Promise<string>
  /**
   * If current selected instance is managed by hmcl modpack, then it will refresh current server-manifest.json and update.
   */
  refresh(): Promise<void>
  /**
   * If current selected instance is managed by hmcl modpack and has update,
   * then it will update current modpack content by server-manifest.json.
   */
  update(): Promise<void>
}

export const InstanceManagingServiceKey: ServiceKey<InstanceManagingService> = 'InstanceManagingService'
