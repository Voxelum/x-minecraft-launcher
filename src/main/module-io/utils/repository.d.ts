export declare class Resource {
    readonly hash: string;
    readonly name: string;
    readonly type: string;
}
export declare class Repository {
    constructor(root: string);
    all(): Map<string, Resource>;
    get(hash: string): Promise<Resource>;
    add(filePath: string): Primise<Resource>;
    refresh(): Promise<Resource[]>;
}
export default Repository