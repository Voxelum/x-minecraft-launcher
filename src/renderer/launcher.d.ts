export interface RemoteLauncher {
    query(service: string, action: string, ...args: any[]): Promise<any>;
}

declare const remote: RemoteLauncher
export default remote