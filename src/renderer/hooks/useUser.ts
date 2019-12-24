import { computed, toRefs } from '@vue/composition-api';
import { UserProfile } from 'universal/store/modules/user.schema';
import { useStore, useBusy } from './useStore';

export function useLogin() {
    const { state, getters, commit, services } = useStore();
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
        login: services.UserService.login,
        switchAccount: services.UserService.switchUserProfile,
        avaiableGameProfiles,
        removeAccount,
    };
}

export function useCurrentUserStatus() {
    const { state, getters, services } = useStore();
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
        checkLocation: services.UserService.checkLocation,
        getChallenges: services.UserService.getChallenges,
        submitChallenges: services.UserService.submitChallenges,
    };
}

export function useCurrentUser() {
    const { getters, services } = useStore();
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
        refreshStatus: services.UserService.refreshStatus,
        switchUserProfile: services.UserService.switchUserProfile,
        logout: services.UserService.logout,
    };
}

export function useCurrentUserSkin() {
    const { getters, services } = useStore();
    return {
        refreshing: useBusy('refreshSkin'),
        url: computed(() => getters.gameProfile.textures.SKIN.url),
        slim: computed(() => (getters.gameProfile.textures.SKIN.metadata ? getters.gameProfile.textures.SKIN.metadata.model === 'slim' : false)),
        refreshSkin: services.UserService.refreshSkin,
        uploadSkin: services.UserService.uploadSkin,
        saveSkin: services.UserService.saveSkin,
    };
}
