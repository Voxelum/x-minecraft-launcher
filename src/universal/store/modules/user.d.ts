import { Auth, GameProfile, MojangAccount, ProfileService, MojangChallenge, MojangChallengeResponse } from '@xmcl/minecraft-launcher-core';
import { Context, Module } from "../store";

export declare namespace UserModule {

    interface GameProfileAndTexture extends GameProfile {
        textures: {
            SKIN: GameProfile.Texture,
            CAPE?: GameProfile.Texture,
            ELYTRA?: GameProfile.Texture,
        }
    }

    interface UserProfile {
        id: string;
        type: string;
        /**
         * The account usually email
         */
        account: string;

        /**
         * The used profile service id
         */
        profileService: string;

        /**
         * The used auth service id
         */
        authService: string;

        /**
         * The access token of the 
         */
        accessToken: string;

        /**
         * all avaiable profiles
         */
        profiles: GameProfileAndTexture[];
    }

    interface SerializedState {
        /**
         * All saved user profiles
         */
        profiles: { [userId: string]: UserProfile };
        selectedUser: string;
        selectedUserProfile: string;

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
         * The login history of the user for a specific auth services
         */
        loginHistory: string[];

        /**
         * The client token of current client. The launcher will generate one at first launch.
         */
        clientToken: string;
    }

    interface CacheState {
        refreshingSkin: boolean;

        /**
         * The mojang user info
         */
        info: MojangAccount?;

        security: boolean;
        refreshingSecurity: boolean;
    }

    interface State extends SerializedState, CacheState {
    }

    interface Getters {
        selectedUser: UserProfile;
        selectedGameProfile: GameProfileAndTexture;
        avaiableGameProfiles: (GameProfileAndTexture & { userId: string; authService: string; profileService: string; account: string; })[];

        logined: boolean;
        offline: boolean;
        authServices: string[];
        profileServices: string[];

        isServiceCompatible: boolean;
        authService: Auth.Yggdrasil.API;
        profileService: ProfileService.API;
    }
    interface Mutations {
        userSnapshot(state: State, snapshot: SerializedState): void;

        invalidateAuth(state: State): void;
        updateGameProfile(state: State, payload: { userId: string; profile: GameProfileAndTexture }): void;
        updateUserProfile(state: State, auth: Auth): void;
        addUserProfile(state: State, profile: UserProfile): void;
        setUserProfile(state: State, profile: { userId: string; profileId: string }): void;
        removeUserProfile(state: State, userId: string): void;

        authService(state: State, service: { name: string, api: Auth.Yggdrasil.API }): void;
        profileService(state: State, service: { name: string, api: ProfileService.API }): void;
        removeService(state: State, name: string): void;

        mojangInfo(state: State, info: MojangAccount): void;
        userSecurity(state: State, security: boolean): void;
        refreshingSecurity(state: State, refreshing: boolean): void;
        refreshingSkin(state: State, refresh: boolean): void;
    }

    type C = Context<State, Getters, Mutations, Actions>;
    interface Actions {
        login(context: C, payload?: { account: string; password?: string, authService?: string, profileService?: string }): Promise<void>;
        switchUserProfile(context: C, profile: { userId: string; profileId: string }): Promise<void>;
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

        listAuthlibs(context: C): Promise<string[]>;
        fetchAuthlibArtifacts(context: C): Promise<{ latest_build_number: number, artifacts: { build_number: number, version: string }[] }>;
        ensureAuthlibInjection(context: C, version?: string): Promise<string>;
    }
}

export interface UserModule extends Module<"user", UserModule.State, UserModule.Getters, UserModule.Mutations, UserModule.Actions> {
}

declare const module: UserModule;

export default module;

