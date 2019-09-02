import { Auth, GameProfile, MojangAccount, ProfileService, MojangChallenge, MojangChallengeResponse } from '@xmcl/minecraft-launcher-core';
import { Context, Module } from "../store";
import { GameProfileAndTexture, UserConfig, UserProfile } from './user.config';

export declare namespace UserModule {
    interface State extends UserConfig {
        refreshingSkin: boolean;

        /**
         * The mojang user info
         */
        info: MojangAccount | null;

        security: boolean;
        refreshingSecurity: boolean;
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
        userSnapshot(state: State, snapshot: UserConfig): void;

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

