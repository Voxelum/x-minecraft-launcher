import type { JavaRecord } from '../entities/java'
import type { Java } from '../entities/java.schema'
import type { SharedState } from '../util/SharedState'
import type { ServiceKey } from './Service'

export class JavaState {
  all = [] as JavaRecord[]

  javaUpdate(java: JavaRecord | JavaRecord[]) {
    if (java instanceof Array) {
      for (const j of java) {
        const existed = this.all.find((jp) => jp.path === j.path)
        if (existed) {
          existed.majorVersion = j.majorVersion
          existed.version = j.version
          existed.valid = j.valid
          existed.arch = j.arch || existed.arch
          existed.isInternal = j.isInternal ?? existed.isInternal
          existed.installVendor = j.installVendor ?? existed.installVendor
          existed.replacesJava = j.replacesJava ?? existed.replacesJava
          existed.replacementRuntime = j.replacementRuntime ?? existed.replacementRuntime
          existed.replacementIdentity = j.replacementIdentity ?? existed.replacementIdentity
          existed.prependCommand = j.prependCommand ?? existed.prependCommand
          existed.vmOptions = j.vmOptions ?? existed.vmOptions
        } else {
          this.all.push(j)
        }
      }
    } else {
      const existed = this.all.find((j) => j.path === java.path)
      if (existed) {
        existed.majorVersion = java.majorVersion
        existed.version = java.version
        existed.valid = java.valid
        existed.arch = java.arch || existed.arch
        existed.isInternal = java.isInternal ?? existed.isInternal
        existed.installVendor = java.installVendor ?? existed.installVendor
        existed.replacesJava = java.replacesJava ?? existed.replacesJava
        existed.replacementRuntime = java.replacementRuntime ?? existed.replacementRuntime
        existed.replacementIdentity = java.replacementIdentity ?? existed.replacementIdentity
        existed.prependCommand = java.prependCommand ?? existed.prependCommand
        existed.vmOptions = java.vmOptions ?? existed.vmOptions
      } else {
        this.all.push(java)
      }
    }
  }

  javaRemove(java: JavaRecord) {
    this.all = this.all.filter((j) => j.path !== java.path)
  }
}

export interface JavaService {
  getJavaState(): Promise<SharedState<JavaState>>
  /**
   * Resolve java info. If the java is not known by launcher, it will cache it into the launcher java list.
   */
  resolveJava(javaPath: string, expectedMajorVersion?: number): Promise<undefined | Java>
  /**
   * scan local java locations and cache
   */
  refreshLocalJava(force?: boolean): Promise<void>

  setJavaSettings(javaPath: string, prependCommand?: string, vmOptions?: string[]): Promise<void>

  /** Persist pending launcher references before removing a replaced runtime. */
  flushJavaUpdate(): Promise<void>

  /** Migrate old references, returning false if the previous runtime cannot be identified safely. */
  migrateJavaReferences(replacementPath: string): Promise<boolean>

  /** Mark a persisted Java replacement as complete. */
  completeJavaReplacement(javaPath: string): Promise<void>

  /** replacementPath enables guarded removal; false means the previous runtime was preserved. */
  removeJava(javaPath: string, attemptUninstall?: boolean, replacementPath?: string): Promise<boolean>
}

export const JavaServiceKey: ServiceKey<JavaService> = 'JavaService'
