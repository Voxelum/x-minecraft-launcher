import CurseForgeService from '@main/service/CurseForgeService';
import DiagnoseService from '@main/service/DiagnoseService';
import InstanceService from '@main/service/InstanceService';
import JavaService from '@main/service/JavaService';
import LaunchService from '@main/service/LaunchService';
import ResourceService from '@main/service/ResourceService';
import ServerStatusService from '@main/service/ServerStatusService';
import SettingService from '@main/service/SettingService';
import UserService from '@main/service/UserService';
import InstallService from '@main/service/InstallService';
import VersionService from '@main/service/VersionService';
import BaseService from './BaseService';
import InstanceLogService from './InstanceLogService';
import { InstanceIOService } from './InstanceIOService';
import InstanceGameSettingService from './InstanceGameSettingService';
import InstanceSavesService from './InstanceSavesService';

export interface BuiltinServices {
    ServerStatusService: ServerStatusService;
    SettingService: SettingService;
    InstanceService: InstanceService;
    DiagnoseService: DiagnoseService;
    /**
     * A stateless service to request curseforge website.
     * The launcher backend will cache the curseforge data neither in memory or in disk.  
     */
    CurseForgeService: CurseForgeService;
    /**
     * Resource service to manage the mod, resource pack, saves, modpack resources.
     * It maintain a preview for resources in memory
     */
    ResourceService: ResourceService;
    VersionService: VersionService;
    InstallService: InstallService;
    UserService: UserService;
    JavaService: JavaService;
    LaunchService: LaunchService;
    BaseService: BaseService;

    InstanceLogService: InstanceLogService;
    InstanceIOService: InstanceIOService;
    InstanceGameSettingService: InstanceGameSettingService;
    InstanceSavesService: InstanceSavesService;
}
