import { ClientModule } from './modules/client';
import { CurseForgeModule } from './modules/curseforge';
import { DiagnoseModule } from './modules/diagnose';
import { JavaModule } from './modules/java';
import { LauncherModule } from './modules/launch';
import { InstanceModule } from './modules/instance';
import { ResourceModule } from './modules/resource';
import { SettingModule } from './modules/setting';
import { TaskModule } from './modules/task';
import { UserModule } from './modules/user';
import { VersionModule } from './modules/version';

declare module './root' {
    interface ModuleMap {
        client: ClientModule;
        curseforge: CurseForgeModule;
        diagnose: DiagnoseModule;
        java: JavaModule;
        launch: LauncherModule;
        instance: InstanceModule;
        resource: ResourceModule;
        setting: SettingModule;
        task: TaskModule;
        user: UserModule;
        version: VersionModule;
    }

    type Semaphore = 'instance' | 'install' | 'java' | 'diagnose' | 'refreshMinecraft' | 'refreshForge' | 'refreshLiteloader';
    interface BaseState {
        /**
         * launcher root data folder path
         */
        root: string;
        online: boolean;
        platform: NodeJS.Platform;
        semaphore: {
            [id: string]: number;
        };
    }
    interface BaseGetters {
        /**
         * @returns if the semaphore is 0
         */
        released: (semaphoreId: Semaphore) => boolean;

        /**
         * @returns true if the semaphore is not 0
         */
        busy: (semaphoreId: Semaphore | Semaphore[]) => boolean;
    }
    interface BaseMutations {
        root: string;
        online: boolean;
        platform: NodeJS.Platform;
        aquire: Semaphore | Semaphore[];
        release: Semaphore | Semaphore[];
    }
    interface BaseActions {
        quit: () => void;
        showItemInFolder: (item: string) => void;
        openItem: (item: string) => void;
    }
}
