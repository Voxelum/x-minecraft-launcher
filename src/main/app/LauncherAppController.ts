import { App, NativeImage, Tray, Dock, Menu, BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { LauncherAppContext } from '@main/manager/AppManager';
import { Store } from 'vuex';

export abstract class LauncherAppController {
    protected app!: App;

    protected Tray!: typeof Tray;

    protected Dock!: typeof Dock;

    protected Menu!: typeof Menu;

    protected getNativeImageAsset!: ((imageName: string) => NativeImage);

    protected newWindow!: ((name: string, url: string, options: BrowserWindowConstructorOptions) => BrowserWindow);

    protected getStaticFile!: (file: string) => string;

    protected store!: Store<any>;

    abstract setup(context: LauncherAppContext): void;

    abstract appReady(app: App): void;

    abstract dataReady(store: Store<string>): Promise<void>;

    abstract requestOpenExternalUrl(url: string): Promise<boolean>;
}
