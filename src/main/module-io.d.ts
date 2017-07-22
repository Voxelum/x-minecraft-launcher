
export interface ModuleIO {
    load?: () => Promise<any>;
    save?: (mutation: string, state: any, payload: any) => Promise<any>;
}

declare const ios: { [moduleId: string]: ModuleIO }

export default ios