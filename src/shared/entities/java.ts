import { Java } from './java.schema'

/**
 * A record of a java path
 */
export interface JavaRecord extends Java {
  valid: boolean
}

/**
 * Return when there is no java
 */
export const EMPTY_JAVA: JavaRecord = {
  version: '',
  majorVersion: 0,
  path: '',
  valid: false,
}
