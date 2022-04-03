/* eslint-disable @typescript-eslint/no-redeclare */
import { Schema } from './schema'
import _SettingSchema from './SettingSchema.json'

export const SettingSchema: Schema<SettingSchema> = _SettingSchema

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface SettingSchema {
  /**
   * The display language of the launcher
   * @default ""
   */
  locale: string
  /**
   * Should launcher auto download new update
   * @default false
   */
  autoDownload: boolean
  /**
   * Should launcher auto install new update after app quit
   * @default false
   */
  autoInstallOnAppQuit: boolean
  /**
   * Should launcher show the pre-release
   * @default false
   */
  allowPrerelease: boolean
  /**
   * The download API set preferences
   * @default "bmcl"
   */
  apiSetsPreference: 'mojang' | 'mcbbs' | 'bmcl'
  /**
   * The supported unofficial api sets
   */
  apiSets: Array<{ name: string; url: string }>
  /**
   * The http proxy address
   * @default ""
   */
  httpProxy: string
  /**
   * Is proxy setting enabled
   * @default false
   */
  httpProxyEnabled: boolean
  /**
   * The launcher theme
   * @default "dark"
   */
  theme: 'dark' | 'light' | 'system'
}
