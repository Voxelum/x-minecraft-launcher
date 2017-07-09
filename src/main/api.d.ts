export declare enum SourceType {
    SERVER = 'server',
    MODPACK = 'modpack'
}

export declare interface LaunchProfile {
    id: string, //inner id
    source?: SourceType,
    name?: string,
    resolution?: [number, number]
    resourcepacks?: string[]
    mods?: string[]
}