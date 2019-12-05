import CurseForgeService from 'main/service/CurseForgeService';
import DiagnoseService from 'main/service/DiagnoseService';
import InstanceService from 'main/service/InstanceService';
import JavaService from 'main/service/JavaService';
import LauncheService from 'main/service/LauncheService';
import ResourceService from 'main/service/ResourceService';
import ServerStatusService from 'main/service/ServerStatusService';
import SettingService from 'main/service/SettingService';
import UserService from 'main/service/UserService';
import VersionInstallService from 'main/service/VersionInstallService';
import VersionService from 'main/service/VersionService';

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
    LaunchService: LauncheService;
}
