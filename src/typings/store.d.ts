type Status = 'remote' | 'local' | 'loading'

import Vue from 'vue'
import { Store, Dispatch, DispatchOptions } from 'vuex'
import { GameProfile, MojangAccount } from 'ts-minecraft';

export as namespace G;

declare module "vuex" {
    interface Dispatch {
        (
            type: "user/login",
            payload?: { account: string; password?: string },
            options?: DispatchOptions
        ): Promise<any>;
        (type: "user/out"): Promise<any>;
    }
}

declare namespace User {
    export interface State {
        clientToken: string,
        accessToken: string,
        selectedProfile: GameProfile,
        profiles: GameProfile[],
        userId: string,
        userType: 'mojang',
        
        skin: {
            data: string,
            slim: boolean,
        },
        cape: string,

        info: MojangAccount,
    }

    interface Dispatch {
        (type: 'login' | 'refresh' | 'logout', payload?: any): Promise<void>;
    }
}

declare namespace VersionsState {
    interface Inner {
        list: object[]
        date: string
        status: { [version: string]: Status }
    }
}
interface VersionsState {
    local: { minecraft: string, forge?: string, liteloader?: string, id: string }[],
    minecraft: VersionsState.Inner,
    forge: VersionsState.Inner,
    liteloader: VersionsState.Inner,
}

interface ProfilesState {
}


interface RootState {
    root: string,
    versions: VersionsState,
    profiles: ProfilesState
}

interface RootDispatch {
    (type: 'user/login', payload: { account: string, password?: string }): Promise<any>;
    (type: 'user/logout'): Promise<any>;

}


