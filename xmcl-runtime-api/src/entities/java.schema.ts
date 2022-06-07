/* eslint-disable @typescript-eslint/no-redeclare */
import { Schema } from './schema'
import _JavaSchema from './JavaSchema.json'
export const JavaSchema: Schema<JavaSchema> = _JavaSchema

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface Java {
  path: string
  version: string
  majorVersion: number
}
export interface JavaSchema {
  /**
   * @default []
   */
  all: Java[]
}
