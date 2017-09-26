interface Profile {
    type: 'modpack' | 'server'
    resolution: Resolution,
    name: string,
    java: string,
    minMemory: number,
    maxMemory?: number,
    vmOptions: [],
    mcOptions: [],
}