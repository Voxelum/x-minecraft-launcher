export declare class Resource {
    readonly hash: string;
    readonly name: string;
    readonly type: string;
}
declare class Repository {
    all(): Map<string, Resource>;
    get(hash: string): Promise<Resource>;
    add(filePath: string): Primise<Resource>;
    refresh(): Promise<Resource[]>;
}
export default Repository