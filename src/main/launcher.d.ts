import { App } from 'electron'
import { EventEmitter } from 'events'
declare interface Launcher extends EventEmitter {
    readonly rootPath: string;
    getPath(...path): string;
    /**
     * Return a proxy of the service
     */
    requireServiceProxy(service: string): any;
}
declare const launcher: Launcher
export default launcher