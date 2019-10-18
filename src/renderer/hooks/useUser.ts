import { computed, toRefs } from "@vue/composition-api";
import { UserProfile } from "universal/store/modules/user.config";
import { Data } from "@vue/composition-api/dist/component";
import { useStore } from "./useStore";
import { useI18n } from "./useI18n";

export function useLogin() {
    const { state, getters, commit, dispatch } = useStore();
    const authServices = computed(() => Object.keys(state.user.authServices));
    const profileServices = computed(() => Object.keys(state.user.profileServices));
    const avaiableGameProfiles = computed(() => getters.avaiableGameProfiles);
    /**
     * Login a new user to the system.
     * @param account The user account. Can be email or other thing the auth service want.
     * @param password The password. Maybe empty string.
     * @param authService The auth service
     * @param profileService The profile serivce
     */
    async function login(account: string, password: string, authService: string, profileService: string) {
        await dispatch('login', { account, password, authService, profileService });
    }
    /**
     * Switch user account.
     * @param userId The user id of the user
     * @param profileId The game profile id of the user
     */
    async function switchAccount(userId: string, profileId: string) {
        await dispatch('switchUserProfile', { userId, profileId });
    }
    /**
     * Remove a user account.
     */
    async function removeAccount(userId: string) {
        commit('removeUserProfile', userId);
    }
    return {
        authServices,
        profileServices,
        login,
        switchAccount,
        avaiableGameProfiles,
        removeAccount,
    }
}

export function useCurrentUser() {
    const { state, getters } = useStore();
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
    };
}

export function useCurrentUserStatus() {
    const { state, getters } = useStore();
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
    };
}

export function useCurrentUserSkin() {
    const { getters, state } = useStore();
    return {
        refreshing: computed(() => state.user.refreshingSkin),
        url: computed(() => getters.selectedGameProfile.textures.SKIN.url),
        slim: computed(() => getters.selectedGameProfile.textures.SKIN.metadata ? getters.selectedGameProfile.textures.SKIN.metadata.model === 'slim' : false)
    }
}
