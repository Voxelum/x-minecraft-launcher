import { Auth, ProfileService } from '@xmcl/minecraft-launcher-core';
import { GameProfile } from '@xmcl/profile-service';

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

export interface UserConfig {
    /**
     * All saved user profiles
     * @default {}
     */
    profiles: { [userId: string]: UserProfile };
    /**
     * @default ""
     */
    selectedUser: string;
    /**
     * @default ""
     */
    selectedUserProfile: string;
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
     * The login history of the user for a specific auth services
     * @default []
     */
    loginHistory: string[];

    /**
     * The client token of current client. The launcher will generate one at first launch.
     * @default ""
     */
    clientToken: string;
}
