
import { ClientModule } from './modules/client';
import { CurseForgeModule } from './modules/curseforge';
import { DiagnoseModule } from './modules/diagnose';
import { IOModule } from './modules/io';
import { JavaModule } from './modules/java';
import { LauncherModule } from './modules/launch';
import { ProfileModule } from './modules/profile';
import { ResourceModule } from './modules/resource';
import { SettingModule } from './modules/setting';
import { TaskModule } from './modules/task';
import { UserModule } from './modules/user';
import { VersionModule } from './modules/version';
import { AuthLibModule } from './modules/authlib';

declare module "./root" {
    interface ModuleMap {
        client: ClientModule;
        curseforge: CurseForgeModule;
        diagnose: DiagnoseModule;
        io: IOModule;
        java: JavaModule;
        launch: LauncherModule;
        profile: ProfileModule;
        resource: ResourceModule;
        setting: SettingModule;
        task: TaskModule;
        user: UserModule;
        version: VersionModule;
        authlib: AuthLibModule;
    }
    interface BaseState {
        /**
         * launcher root data folder path
         */
        root: string
        online: boolean
        platform: NodeJS.Platform
    }
    interface BaseGetters {
        /**
         * @returns the path relate to the launcher root data folder
         */
        path: (...args: string[]) => string
    }
    interface BaseMutations {
        root: string;
        online: boolean;
        platform: NodeJS.Platform;
    }
    interface BaseActions {
        quit: () => void;
        showItemInFolder: (item: string) => void;
        openItem: (item: string) => void;
    }
}