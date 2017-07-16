import { App } from 'electron'
import { EventEmitter } from 'events'
declare interface Launcher extends EventEmitter {
    readonly rootPath: string;
    getPath(...path): string;
    requireModule(module: string): any;
    requireService(service: string): any;
}
declare const launcher: Launcher
export default launcher