interface CreateOption {
    type: 'modpack' | 'server',
    option?: {
        name?: string, // specific info
        resolution?: { width: number, height: number, fullscreen: boolean }, // client setting
        java?: string,
        minMemory?: number,
        maxMemory?: number,
        vmOptions?: Array,
        mcOptions?: Array,
        minecraft?: {
            version: string,
        },
        forge?: {
            version: string,
        },
        liteloader?: {
            version: string,
        },
        host?: string,
        port?: number,
        isLanServer?: boolean,

        author?: string,
        description?: string,
    }
}

declare const profiles: {
    actions: {
        create(context, option: CreateOption);
    }
}
export default profiles