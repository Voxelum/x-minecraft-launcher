import { computed, toRefs } from "@vue/composition-api";
import { Data } from "@vue/composition-api/dist/component";
import { UserProfile } from "universal/store/modules/user.config";
import { useStore } from "./useStore";

export function useLogin() {
    const { state, getters, commit, services } = useStore();
    const authServices = computed(() => Object.keys(state.user.authServices));
    const profileServices = computed(() => Object.keys(state.user.profileServices));
    const avaiableGameProfiles = computed(() => getters.avaiableGameProfiles);
    /**
     * Remove a user account.
     */
    async function removeAccount(userId: string) {
        commit('removeUserProfile', userId);
    }
    return {
        authServices,
        profileServices,
        login: services.UserService.login,
        switchAccount: services.UserService.switchUserProfile,
        avaiableGameProfiles,
        removeAccount: removeAccount,
    }
}

export function useCurrentUser() {
    const { state, getters, services } = useStore();
    const user: UserProfile & Data = getters.selectedUser as any;
    const theAuthService = computed(() => getters.authService);
    const theProfileService = computed(() => getters.profileService);
    const loginHistory = computed(() => state.user.loginHistory);
    const name = computed(() => getters.selectedGameProfile.name);
    const profileId = computed(() => getters.selectedGameProfile.name);

    return {
        ...toRefs(user),
        name,
        profileId,
        theAuthService,
        theProfileService,
        loginHistory,
        ...useCurrentUserStatus(),
        refreshStatus: services.UserService.refreshStatus,
        switchUserProfile: services.UserService.switchUserProfile,
        logout: services.UserService.logout,
    };
}

export function useCurrentUserStatus() {
    const { state, getters, services } = useStore();
    const user: UserProfile & Data = getters.selectedUser as any;
    const offline = computed(() => getters.offline);
    const logined = computed(() => getters.logined);
    const isServiceCompatible = computed(() => getters.isServiceCompatible);
    const security = computed(() => user.authServices === 'mojang' ? state.user.security : true);
    const refreshingSecurity = computed(() => state.user.refreshingSecurity);
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

export function useCurrentUserSkin() {
    const { getters, state, services } = useStore();
    return {
        refreshing: computed(() => state.user.refreshingSkin),
        url: computed(() => getters.selectedGameProfile.textures.SKIN.url),
        slim: computed(() => getters.selectedGameProfile.textures.SKIN.metadata ? getters.selectedGameProfile.textures.SKIN.metadata.model === 'slim' : false),
        refreshSkin: services.UserService.refreshSkin,
        uploadSkin: services.UserService.uploadSkin,
        saveSkin: services.UserService.saveSkin,
    }
}

