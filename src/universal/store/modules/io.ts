import { ModuleOption } from "../root";

export type IOModule = ModuleOption<{}, {}, {}, Actions>;

export interface Actions {
    readFolder: (folder: string) => string[];
    setPersistence: (payload: { path: string, data: object, schema?: string }) => void;
    getPersistence: (payload: { path: string, schema?: string }) => any;
    electronDownloadFile: (payload: { url: string }) => TaskHandle;
}

const mod: IOModule = {}

export default mod;
