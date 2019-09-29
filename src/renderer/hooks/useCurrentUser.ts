import useStore from "@/hooks/useStore";
import { computed, toRefs } from "@vue/composition-api";
import { UserProfile } from "universal/store/modules/user.config";
import { Data } from "@vue/composition-api/dist/component";

export function useCurrentUser() {
    const { state, getters } = useStore();
    const user: UserProfile & Data = getters.selectedUser as any;
    const offline = computed(() => getters.offline);
    const logined = computed(() => getters.logined);
    const isServiceCompatible = computed(() => getters.isServiceCompatible);
    const theAuthService = computed(() => getters.authService);
    const theProfileService = computed(() => getters.profileService);
    const loginHistory = computed(() => state.user.loginHistory);
    const security = computed(() => user.authServices === 'mojang' ? state.user.security : true);
    const selectedGameProfile = computed(() => getters.selectedGameProfile);

    return {
        ...toRefs(user),
        selectedGameProfile,
        logined,
        offline,
        isServiceCompatible,
        theAuthService,
        theProfileService,
        loginHistory,
        security,
    };
}

