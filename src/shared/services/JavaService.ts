import { EMPTY_JAVA, JavaRecord } from '../entities/java'
import { requireObject, requireString } from '../util/assert'
import { StatefulService, ServiceKey, State } from './Service'
import { Java } from '/@shared/entities/java.schema'

export interface JavaState extends State {
}

export class JavaState {
  all = [] as JavaRecord[]
  get defaultJava() {
    return this.all.find(j => j.valid && j.majorVersion === 8) || this.all.find(j => j.valid) || EMPTY_JAVA
  }

  get missingJava() {
    return this.all.length === 0
  }

  javaUpdate(java: JavaRecord | JavaRecord[]) {
    if (java instanceof Array) {
      for (const j of java) {
        const existed = this.all.find(jp => jp.path === j.path)
        if (existed) {
          existed.majorVersion = j.majorVersion
          existed.version = j.version
          existed.valid = j.valid
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
      } else {
        this.all.push(java)
      }
    }
  }

  javaRemove(java: JavaRecord) {
    requireObject(java)
    requireString(java.path)
    // TODO: remove in vue3
    this.all = this.all.filter(j => j.path !== java.path && j.version !== java.version)
  }
}

export interface JavaService extends StatefulService<JavaState> {
  /**
   * Install a default jdk 8 to the a preserved location. It'll be installed under your launcher root location `jre` folder
   */
  installDefaultJava(): Promise<void>
  /**
   * Resolve java info. If the java is not known by launcher. It will cache it into the launcher java list.
   */
  resolveJava(javaPath: string): Promise<undefined | Java>
  /**
   * scan local java locations and cache
   */
  refreshLocalJava(): Promise<void>
}

export const JavaServiceKey: ServiceKey<JavaService> = 'JavaService'
