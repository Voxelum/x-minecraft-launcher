import { ServiceKey } from './Service'
import { Java } from '/@shared/entities/java.schema'

export interface JavaService {
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
