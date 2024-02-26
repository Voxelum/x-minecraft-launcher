import { JavaVersion } from '@xmcl/core'
import { JavaRecord } from '../entities/java'
import { Java } from '../entities/java.schema'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'

export class JavaState {
  all = [] as JavaRecord[]

  javaUpdate(java: JavaRecord | JavaRecord[]) {
    if (java instanceof Array) {
      for (const j of java) {
        const existed = this.all.find(jp => jp.path === j.path)
        if (existed) {
          existed.majorVersion = j.majorVersion
          existed.version = j.version
          existed.valid = j.valid
          existed.arch = j.arch || existed.arch
        } else {
          this.all.push(j)
        }
      }
    } else {
      const existed = this.all.find(j => j.path === java.path)
      if (existed) {
        existed.majorVersion = java.majorVersion
        existed.version = java.version
        existed.valid = java.valid
        existed.arch = java.arch || existed.arch
      } else {
        this.all.push(java)
      }
    }
  }

  javaRemove(java: JavaRecord) {
    this.all = this.all.filter(j => j.path !== java.path)
  }
}

export interface JavaService {
  getJavaState(): Promise<MutableState<JavaState>>
  /**
   * Install a default jdk 8 or 16 to the a preserved location. It'll be installed under your launcher root location `jre` or `jre-next` folder
   */
  installDefaultJava(version?: JavaVersion): Promise<undefined | Java>
  /**
   * Resolve java info. If the java is not known by launcher. It will cache it into the launcher java list.
   */
  resolveJava(javaPath: string): Promise<undefined | Java>
  /**
   * scan local java locations and cache
   */
  refreshLocalJava(force?: boolean): Promise<void>

  removeJava(javaPath: string): Promise<void>
}

export const JavaServiceKey: ServiceKey<JavaService> = 'JavaService'
