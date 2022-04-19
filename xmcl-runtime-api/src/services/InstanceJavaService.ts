import { JavaVersion } from '@xmcl/core'
import { IssueKey } from '../entities/issue'
import { JavaRecord } from '../entities/java'
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

interface IncompatibleJavaIssue {
  /**
   * The current java
   */
  java: string
  /**
   * The selected game version. Might be empty if the current version is not downloaded
   */
  version: string
  /**
   * The version requirement
   */
  requirement: string

  minecraft: string
  forge: string

  targetVersion?: JavaVersion
}

/**
 * Current java path is invalid. Like file not existed or java is broken.
 */
export const InvalidJavaIssueKey: IssueKey<{ path: string }> = 'invalidJava'
/**
 * Current selected java might be incompatible with minecraft
 */
export const IncompatibleJavaIssueKey: IssueKey<IncompatibleJavaIssue> = 'incompatibleJava'
/**
 * Cannot find proper java for fulfill the requirement
 */
export const MissingJavaIssueKey: IssueKey<{ targetVersion: JavaVersion | undefined }> = 'missingJava'

/**
 * Provide the service to host the java info of the instance
 */
export interface InstanceJavaService extends StatefulService<InstanceJavaState> {
  updateJava(): Promise<void>
}

export const InstanceJavaServiceKey: ServiceKey<InstanceJavaService> = 'InstanceJavaService'
