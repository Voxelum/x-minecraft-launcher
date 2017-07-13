import { App } from 'electron'
import { EventEmitter } from 'events'
declare class Launcher extends EventEmitter {
    readonly profiles: string;
    readonly resourcepacks: string;
    readonly mods: string;
    readonly app: App;
    require(module: string): any;
}
export default Launcher