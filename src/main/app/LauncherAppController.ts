import { StaticStore } from '@universal/util/staticStore';

export interface LauncherAppController {
    processFirstLaunch(): Promise<string>;
    engineReady(): Promise<void>;
    dataReady(store: StaticStore<any>): Promise<void>;
}
