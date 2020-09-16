import { GameProfileAndTexture, UserProfile } from './user.schema';

export interface UserGameProfile extends Omit<UserProfile, 'profiles'>, GameProfileAndTexture {
    userId: string; 
    id: string;
}

export const EMPTY_USER = Object.freeze({ id: '', username: '', profileService: '', authService: '', accessToken: '', profiles: [], properties: {} });
export const EMPTY_GAME_PROFILE = Object.freeze({ id: '', name: '', textures: { SKIN: { url: '' } } });
