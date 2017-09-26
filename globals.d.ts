import { ServerStatus, Auth as McAuth, VersionMeta } from 'ts-minecraft'

declare var testADS: number

export declare namespace State {
    interface Root {
        defaultResolution: Resolution,
        autoDownload: boolean,
        url: string,
        theme: string,
        themes: string[],
        javas: string[],

        profiles: Profiles,
        auth: Auth,
        versions: Versions,
        mods: Mods,
        resourcepacks: ResourcePacks,
        tasks: Tasks,
        curseforge: CurseForge,
        drag: Drag,
    }
    interface Drag {
        dragover: boolean,
    }
    interface Repository {
        root: string,
        resources: { [hash: string]: Resource },
    }
    interface Resource {
        hash: string,
        name: string,
        type: string,
        meta: any,
    }
    interface Mods extends Repository { }
    interface ResourcePacks extends Repository { }
    interface Tasks { }
    interface CurseForge {
        mods: {},
        page: number,
        pages: number,
        version: string,
        versions: string[],
        filter: string,
        filters: string[],
        category: string,
        categories: string[],
        loading: boolean,
        cached: any
    }

    interface Versions {
        minecraft: {
            updateTime: string,
            versions: VersionMeta,
            latest: {
                snapshot: string,
                release: string,
            }
        },
        forge: {
            updateTime: string,
        }
    }

    interface Auth {
        modes: string[],
        mode: string,
        history: { [mode: string]: string[] },
        auth?: McAuth,
        cache: {
            skin: {
                data?: string,
                slim?: boolean,
            },
            cape?: string,
        }
    }

    interface Profiles {
        all: ProfileState[],
        selected: string,
    }

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

    interface Resolution {
        width: number,
        height: number,
        fullscreen?: boolean,
    }

    interface Modpack extends Profile {
        editable: boolean,
        author: string,
        description: string,
        url: string,
        icon: string,
    }

    interface Server extends Profile {
        host: string,
        port: number,
        isLanServer: boolean,
        icon: string,
        status?: ServerStatus,
    }
}