import { Auth, ProfileService } from '@xmcl/minecraft-launcher-core';
import { GameProfile } from '@xmcl/profile-service';

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface GameProfileAndTexture extends GameProfile {
    textures: {
        SKIN: GameProfile.Texture;
        CAPE?: GameProfile.Texture;
        ELYTRA?: GameProfile.Texture;
    };
}

export interface UserProfile {
    id: string;
    /**
     * The username usually email
     */
    username: string;

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
     * All avaiable pgame rofiles
     */
    profiles: { [uuid: string]: GameProfileAndTexture };
}

export interface UserSchema {
    /**
     * All saved user account through mutliple services
     * @default {}
     */
    users: { [account: string]: UserProfile };

    /**
     * Contains the UUID-hashed account and the UUID of the currently selected user
     * @default { "account": "", "profile": "" }
     */
    selectedUser: {
        /**
         * The UUID-hashed key of the currently selected user
         * @default ""
         */
        id: string;
        /**
         * The UUID of the currently selected player
         * @default ""
         */
        profile: string;
    };
    /**
     * All loaded auth services api. Used for ygg auth
     * @default {}
     */
    authServices: {
        [name: string]: Auth.Yggdrasil.API;
    };
    /**
     * All loaded profile services api. Used for
     * @default {}
     */
    profileServices: {
        [name: string]: ProfileService.API;
    };
    /**
     * The client token of current client. The launcher will generate one at first launch.
     * @default ""
     */
    clientToken: string;
}

export const UserSchema: object = require('./UserSchema.json'); 
