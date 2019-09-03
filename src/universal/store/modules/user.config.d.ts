import { Auth, GameProfile, ProfileService } from '@xmcl/minecraft-launcher-core';

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

interface UserConfig {
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

