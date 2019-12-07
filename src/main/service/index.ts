import CurseForgeService from 'main/service/CurseForgeService';
import DiagnoseService from 'main/service/DiagnoseService';
import InstanceService from 'main/service/InstanceService';
import JavaService from 'main/service/JavaService';
import LaunchService from 'main/service/LaunchService';
import ResourceService from 'main/service/ResourceService';
import ServerStatusService from 'main/service/ServerStatusService';
import SettingService from 'main/service/SettingService';
import UserService from 'main/service/UserService';
import VersionInstallService from 'main/service/VersionInstallService';
import VersionService from 'main/service/VersionService';
import BaseService from './BaseService';

export interface BuiltinServices {
    ServerStatusService: ServerStatusService;
    SettingService: SettingService;
    InstanceService: InstanceService;
    DiagnoseService: DiagnoseService;
    CurseForgeService: CurseForgeService;
    ResourceService: ResourceService;
    VersionService: VersionService;
    VersionInstallService: VersionInstallService;
    UserService: UserService;
    JavaService: JavaService;
    LaunchService: LaunchService;
    BaseService: BaseService;
}
