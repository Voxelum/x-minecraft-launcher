import { Context, Module, TaskHandle } from "../store";

export type IOModule = Module<"io", {}, {}, {}, Actions>;

type C = Context<{}, {}, {}, Actions>;
export interface Actions {
    readFolder(context: C, folder: string): Promise<string[]>;
    setPersistence(context: C, payload: { path: string, data: object, schema?: string }): Promise<void>;
    getPersistence(context: C, payload: { path: string, schema?: string }): Promise<any>;

    electronDownloadFile(context: C, payload: { url: string }): Promise<TaskHandle>
}

const mod: IOModule = {}

export default mod;
