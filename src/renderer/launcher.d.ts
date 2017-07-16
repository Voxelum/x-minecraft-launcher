export interface RemoteLauncher {
    query(service: string, action: string, ...args: any[]): Promise<any>;
    /**
     * Fetch All state from remote
     */
    fetchAll(): Promise<{ [module: string]: any }>;
    /**
     * Fetch a state for a module (by id) 
     */
    fetch(module: string): Promise<any>;
    /**
     * Update a module's state to server. Server will save this
     */
    update(module: string, state: any): Promise<any>;
}

declare const remote: RemoteLauncher
export default remote