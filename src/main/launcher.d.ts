import { App } from 'electron'
import { EventEmitter } from 'events'
declare interface Launcher extends EventEmitter {
    readonly rootPath: string;
    readonly app: App;
    getPath(...path): string;
    require(module: string): any;
}
declare const launcher: Launcher
export default launcher