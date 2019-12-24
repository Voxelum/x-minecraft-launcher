import { YggdrasilAuthAPI, ProfileServiceAPI, GameProfile } from '@xmcl/user';
import Schema from '../Schema';

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
    /**
     * user id
     */
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
        [name: string]: YggdrasilAuthAPI;
    };
    /**
     * All loaded profile services api. Used for
     * @default {}
     */
    profileServices: {
        [name: string]: ProfileServiceAPI;
    };
    /**
     * The client token of current client. The launcher will generate one at first launch.
     * @default ""
     */
    clientToken: string;
}

export const UserSchema: Schema<UserSchema> = require('./UserSchema.json'); 
