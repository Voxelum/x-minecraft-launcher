import { Auth, GameProfile, MojangAccount, ProfileService, MojangChallenge, MojangChallengeResponse } from 'ts-minecraft';
import { Context, Module } from "../store";

export declare namespace UserModule {

    type Snapshot = Partial<Omit<State, 'info'>>;

    interface SerializedState {
        /**
         * The user unique id
         */
        id: string;
        /**
         * The user name
         */
        name: string;
        /**
         * The cached access token
         */
        accessToken: string;

        /**
         * All loaded auth services api. Used for ygg auth
         */
        authServices: {
            mojang: Auth.Yggdrasil.API;
            [name: string]: Auth.Yggdrasil.API;
        };
        /**
         * All loaded profile services api. Used for 
         */
        profileServices: {
            mojang: ProfileService.API;
            [name: string]: ProfileService.API;
        };

        /**
         * Selected profile service.
         */
        profileService: string;
        /**
         * Selected auth service.
         */
        authService: string;

        /**
         * The login history of the user for a specific auth services
         */
        loginHistory: { [mode: string]: string[] };

        /**
         * The client token of current client. The launcher will generate one at first launch.
         */
        clientToken: string;

        userId: string;
        userType: UserType;
        properties: {
            [key: string]: string;
        };
    }
    interface State extends SerializedState {
        skin: {
            data: string;
            slim: boolean;
        };
        /**
         * The caced cape data uri
         */
        cape: string;

        /**
         * The mojang user info
         */
        info: MojangAccount?;
    }

    interface Mutations {
        userSnapshot(state: State, snapshot: Snapshot): void;

        login(state: State, info: { auth: Auth, account?: string }): void;
        logout(state: State): void;
        textures(state: State, textures: GameProfile.Textures): void;
        mojangInfo(state: State, info: MojangAccount): void;
        authService(state: State, mode: string): void;
        profileService(state: State, mode: string): void;
    }
    interface Getters {
        loginHistories: string[]
        logined: boolean
        offline: boolean
        authServices: string[]
        profileServices: string[]

        isServiceCompatible: boolean
        authService: Auth.Yggdrasil.API
        profileService: ProfileService.API
    }

    type C = Context<State, Getters, Mutations, Actions>;
    interface Actions {
        selectLoginMode(context: C, mode: string): Promise<void>;

        login(context: C, payload?: { account: string; password?: string }, options?: DispatchOptions): Promise<void>;
        logout(context: C): Promise<void>;

        refreshUser(context: C): Promise<void>;
        refreshInfo(context: C): Promise<void>;
        refreshSkin(context: C): Promise<void>;

        /**
         * Check current ip location and determine wether we need to validate user identity by response challenge.
         * 
         * See `getChallenges` and `submitChallenges`
         */
        checkLocation(context: C): Promise<boolean>;
        /**
         * Get all the user set challenges for security reasons.
         */
        getChallenges(context: C): Promise<MojangChallenge[]>;
        submitChallenges(context: C, responses: MojangChallengeResponse[]): Promise<any>;

        uploadSkin(context: C, payload: { data: string | Buffer, slim: boolean }): Promise<void>;
        saveSkin(context: C, payload: { skin: { data: string }, path: string }): Promise<void>;
        parseSkin(context: C, path: string): Promise<string | undefined>;
    }
}

export interface UserModule extends Module<"user", UserModule.State, UserModule.Getters, UserModule.Mutations, UserModule.Actions> {
}

declare const module: UserModule;

export default module;

