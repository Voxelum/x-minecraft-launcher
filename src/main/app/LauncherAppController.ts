import { StaticStore } from '/@shared/util/staticStore'

export interface LauncherAppController {
    processFirstLaunch(): Promise<string>;
    requireFocus(): void;
    engineReady(): Promise<void>;
    dataReady(store: StaticStore<any>): Promise<void>;
}
