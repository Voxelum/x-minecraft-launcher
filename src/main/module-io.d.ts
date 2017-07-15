
export interface ModuleIO {
    load?: (context: ModuleIO.Context) => Promise<any>;
    save?: (context: ModuleIO.Context, state: any) => Promise<any>;
}

export namespace ModuleIO {
    export interface Context {
        getPath(...paths: string[]): string;
    }
}