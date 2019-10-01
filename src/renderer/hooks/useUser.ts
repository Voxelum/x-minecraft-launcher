import { computed, toRefs } from "@vue/composition-api";
import { UserProfile } from "universal/store/modules/user.config";
import { Data } from "@vue/composition-api/dist/component";
import { useStore } from "./useStore";
import { useI18n } from "./useI18n";

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

export function useUserServices() {
    const { state } = useStore();
    const { t } = useI18n();
    return {
        authServices: Object.entries(state.user.authServices).map(([id, serv]) => ({
            id,
            name: id === 'offline' || id === 'mojang' ? t(`user.${name}.id`) : id,
            ...serv,
        })),
        profileServices: Object.entries(state.user.profileServices).map(([id, serv]) => ({
            id,
            name: id === 'offline' || id === 'mojang' ? t(`user.${name}.id`) : id,
            ...serv,
        })),
    }
}