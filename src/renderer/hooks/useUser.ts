import { UserProfile } from '@universal/store/modules/user.schema';
import { computed, toRefs } from '@vue/composition-api';
import { useServiceOnly } from './useService';
import { useBusy, useStore } from './useStore';

export function useLogin() {
    const { state, getters, commit } = useStore();
    const authServices = computed(() => ['offline', ...Object.keys(state.user.authServices)]);
    const profileServices = computed(() => Object.keys(state.user.profileServices));
    const avaiableGameProfiles = computed(() => getters.gameProfiles);
    /**
     * Remove a user account.
     */
    async function removeAccount(userId: string) {
        commit('userProfileRemove', userId);
    }
    return {
        authServices,
        profileServices,
        ...useServiceOnly('UserService', 'login', 'switchUserProfile'),
        avaiableGameProfiles,
        removeAccount,
    };
}

export function useCurrentUserStatus() {
    const { state, getters } = useStore();
    const user: UserProfile & Data = getters.user as any;
    const offline = computed(() => getters.offline);
    const logined = computed(() => getters.accessTokenValid);
    const isServiceCompatible = computed(() => getters.isServiceCompatible);
    const security = computed(() => (user.authServices === 'mojang' ? state.user.mojangSecurity : true));
    const refreshingSecurity = useBusy('checkLocation');
    return {
        logined,
        offline,
        isServiceCompatible,
        security,
        refreshingSecurity,
        ...useServiceOnly('UserService', 'checkLocation', 'getChallenges', 'submitChallenges'),
    };
}

export function useCurrentUser() {
    const { getters } = useStore();
    const user: UserProfile & Data = getters.user as any;
    const theAuthService = computed(() => getters.authService);
    const theProfileService = computed(() => getters.profileService);
    /**
     * selected profile name
     */
    const name = computed(() => getters.gameProfile.name);
    /**
     * selected profile id
     */
    const profileId = computed(() => getters.gameProfile.id);

    return {
        ...toRefs(user),
        name,
        profileId,
        theAuthService,
        theProfileService,
        ...useCurrentUserStatus(),
        ...useServiceOnly('UserService', 'refreshStatus', 'switchUserProfile', 'logout'),
    };
}

export function useCurrentUserSkin() {
    const { getters } = useStore();
    return {
        refreshing: useBusy('refreshSkin'),
        url: computed(() => getters.gameProfile.textures.SKIN.url),
        slim: computed(() => (getters.gameProfile.textures.SKIN.metadata ? getters.gameProfile.textures.SKIN.metadata.model === 'slim' : false)),
        ...useServiceOnly('UserService', 'refreshSkin', 'uploadSkin', 'saveSkin'),
    };
}
