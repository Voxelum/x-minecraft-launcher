import { JavaVersion } from '@xmcl/core'
import { IssueKey } from '../entities/issue'
import { JavaRecord } from '../entities/java'
import { Java } from '../entities/java.schema'
import { ServiceKey, StatefulService } from './Service'

export class InstanceJavaState {
  java: JavaRecord | undefined

  instanceJava(java: JavaRecord | undefined) {
    this.java = java
  }
}

export enum JavaCompatibleState {
  Matched,
  MayIncompatible,
  VeryLikelyIncompatible,
}

interface BaseJavaIssue {
  /**
    * The java version requirement string
    */
  requirement: string
  /**
    * Best matched java path to select. (Only present if there is a suitable java)
    */
  recommendedVersion?: Java
  recommendedLevel?: JavaCompatibleState
  /**
    * Recommended to download java version automatically. (Please use this if there is no suitable java)
    */
  recommendedDownload?: JavaVersion
  /**
    * The selected game version.
    *
    * Might be empty if the current version is not downloaded.
    */
  version: string
  /**
    * Current minecraft
    */
  minecraft: string
  /**
    * Current forge
    */
  forge: string
}

interface IncompatibleJavaIssue extends BaseJavaIssue {
  /**
   * The current java info. Can either be user assigned, or be launcher computed
   */
  selectedJava: Java
}

/**
 * Only present if user assigned java path
 */
interface InvalidJavaIssue extends BaseJavaIssue {
  /**
   * The user assigned java path
   */
  selectedJavaPath: string
}

interface MissingJavaIssue extends BaseJavaIssue {

}

/**
 * Current java path is invalid. Like file not existed or java is broken.
 */
export const InvalidJavaIssueKey: IssueKey<InvalidJavaIssue> = 'invalidJava'
/**
 * Current selected java might be incompatible with minecraft
 */
export const IncompatibleJavaIssueKey: IssueKey<IncompatibleJavaIssue> = 'incompatibleJava'
/**
 * Cannot find proper java for fulfill the requirement
 */
export const MissingJavaIssueKey: IssueKey<MissingJavaIssue> = 'missingJava'

/**
 * Provide the service to host the java info of the instance
 */
export interface InstanceJavaService extends StatefulService<InstanceJavaState> {
  updateJava(): Promise<void>
}

export const InstanceJavaServiceKey: ServiceKey<InstanceJavaService> = 'InstanceJavaService'
