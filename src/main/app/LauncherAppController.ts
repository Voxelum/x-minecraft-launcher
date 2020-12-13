import { StaticStore } from '@universal/util/staticStore';

export interface LauncherAppController {
    processFirstLaunch(): Promise<string>;
    requireFocus(): void;
    engineReady(): Promise<void>;
    dataReady(store: StaticStore<any>): Promise<void>;
}
