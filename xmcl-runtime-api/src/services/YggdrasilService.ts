import { YggdrasilApi } from '../entities/yggdrasil.schema'
import { ServiceKey } from './Service'

export interface YggdrasilService {
  /**
   * Get all third-party account system satisfy the authlib-injector format
   */
  getYggdrasilServices(): Promise<YggdrasilApi[]>
  /**
   * Add a third-party account system satisfy the authlib-injector format
   * @param url The account api url
   */
  addYggdrasilService(url: string): Promise<void>
  /**
   * Remove a third-party account system satisfy the authlib-injector format
   * @param url The account api url
   */
  removeYggdrasilService(url: string): Promise<void>
}

export const YggdrasilServiceKey: ServiceKey<YggdrasilService> = 'YggdrasilService'
