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
  resolveJava(javaPath: string): Promise<undefined | Java>
  /**
   * scan local java locations and cache
   */
  refreshLocalJava(force?: boolean): Promise<void>

  setJavaSettings(javaPath: string, prependCommand?: string, vmOptions?: string[]): Promise<void>

  removeJava(javaPath: string, attemptUninstall?: boolean): Promise<void>
}

export const JavaServiceKey: ServiceKey<JavaService> = 'JavaService'
