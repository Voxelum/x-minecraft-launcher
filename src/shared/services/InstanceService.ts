import { Status } from '@xmcl/client'
import { ServerInfo } from '@xmcl/server-info'
import { DeepPartial } from '../util/object'
import { ServiceKey } from './Service'
import { InstanceSchema, RuntimeVersions } from '/@shared/entities/instance.schema'
export declare type CreateOption = DeepPartial<Omit<InstanceSchema, 'id' | 'lastAccessDate' | 'creationDate'> & {
  path: string
}>
export interface EditInstanceOptions extends Partial<Omit<InstanceSchema, 'deployments' | 'runtime' | 'server'>> {
  deployments?: Record<string, string[]>
  runtime?: Partial<RuntimeVersions>
  /**
     * If this is undefined, it will disable the server of this instance
     */
  server?: {
    /**
         * The host of the server (ip)
         */
    host: string
    /**
         * The port of the server
         */
    port?: number
  } | null
  /**
    * The target instance path. If this is absent, it will use the selected instance.
    */
  instancePath?: string
}
/**
 * Provide instance spliting service. It can split the game into multiple environment and dynamiclly deploy the resource to run.
 */
export interface InstanceService {
  loadInstance(path: string): Promise<boolean>
  /**
     * Create a managed instance (either a modpack or a server) under the managed folder.
     * @param option The creation option
     * @returns The instance path
     */
  createInstance(payload: CreateOption): Promise<string>
  /**
     * Create a managed instance in storage.
     */
  createAndMount(payload: CreateOption): Promise<string>
  /**
     * Mount the instance as the current active instance.
     * @param path the instance path
     */
  mountInstance(path: string): Promise<void>
  /**
     * Delete the managed instance from the disk
     * @param path The instance path
     */
  deleteInstance(path?: string): Promise<void>
  /**
     * Edit the instance. If the `path` is not present, it will edit the current selected instance.
     * Otherwise, it will edit the instance on the provided path.
     */
  editInstance(options: EditInstanceOptions): Promise<void>
  /**
    * If current instance is a server. It will refresh the server status
    */
  refreshServerStatus(): Promise<void>
  /**
     * Refresh all instance server status if present
     */
  refreshServerStatusAll(): Promise<void>
  /**
     * Create a instance by server info and status.
     * This will try to ping the server and apply the mod list if it's a forge server.
     */
  createInstanceFromServer(info: ServerInfo & {
    status: Status
  }): Promise<string>
}

export const InstanceServiceKey: ServiceKey<InstanceService> = 'InstanceService'
