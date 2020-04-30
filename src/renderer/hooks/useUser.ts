import { UserProfile } from '@universal/store/modules/user.schema';
import { LoginException } from '@universal/util/exception';
import { computed, onMounted, reactive, Ref, toRefs, watch } from '@vue/composition-api';
import { useI18n } from './useI18n';
import { useServiceOnly } from './useService';
import { useBusy, useStore } from './useStore';
import { EMPTY_GAME_PROFILE } from '@universal/store/modules/user';

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
    const { state } = useStore();
    const { refreshSkin, uploadSkin, saveSkin } = useServiceOnly('UserService', 'refreshSkin', 'uploadSkin', 'saveSkin');
    const data = reactive({
        url: '',
        slim: false,
        loading: false,
    });
    const gameProfile = computed(() => state.user.users[state.user.selectedUser.id]?.profiles[state.user.selectedUser.profile] || EMPTY_GAME_PROFILE);
    function reset() {
        data.url = gameProfile.value.textures.SKIN.url;
        data.slim = gameProfile.value.textures.SKIN.metadata ? gameProfile.value.textures.SKIN.metadata.model === 'slim' : false;
    }
    const modified = computed(() => data.url !== gameProfile.value.textures.SKIN.url
        || data.slim !== (gameProfile.value.textures.SKIN.metadata ? gameProfile.value.textures.SKIN.metadata.model === 'slim' : false));
    async function save() {
        data.loading = true;
        try {
            await uploadSkin({ url: data.url, slim: data.slim });
        } finally {
            data.loading = false;
        }
    }
    onMounted(() => {
        refreshSkin();
        reset();
    });
    watch(gameProfile, () => {
        refreshSkin();
        reset();
    });
    return {
        ...toRefs(data),
        refreshing: useBusy('refreshSkin'),
        refresh: refreshSkin,
        save,
        reset,
        modified,

        exportTo: saveSkin,
    };
}

export function useLogin() {
    const { state, commit } = useStore();
    const authServices = computed(() => ['offline', ...Object.keys(state.user.authServices)]);
    const profileServices = computed(() => Object.keys(state.user.profileServices));
    const profiles = computed(() => Object.entries(state.user.users)
        .map(([userId, user]) => Object.values(user.profiles)
            .map((profile) => ({ ...profile, userId, authService: user.authService, profileService: user.profileService, username: user.username, accessToken: user.accessToken })))
        .reduce((a, b) => [...a, ...b], []));
    watch(profiles, () => {
        console.log(`Profiles ${profiles.value}`);
    });
    const { logined, username, authService, profileService, profileId, id } = useCurrentUser();
    const { login, switchUserProfile } = useServiceOnly('UserService', 'login', 'switchUserProfile');
    function remove(userId: string) {
        commit('userProfileRemove', userId);
    }
    const data = reactive({
        logining: false,
        username: '',
        password: '',
        authService: '',
        profileService: '',

        profile: '',
        user: '',
    });
    function select() {
        return switchUserProfile({ profileId: data.profile, userId: data.user });
    }
    async function _login() {
        data.logining = true;
        await login(data).finally(() => { data.logining = false; });
    }
    function reset() {
        data.logining = false;
        data.username = username.value;
        data.password = '';
        data.authService = authService.value ?? 'mojang';
        data.profileService = profileService.value ?? 'mojang';

        data.user = id.value;
        data.profile = profileId.value;
    }
    return {
        ...toRefs(data),
        logined,
        login: _login,
        reset,
        select,
        remove,
        profiles,

        selectedProfile: profileId,
        selectedUser: id,

        authServices,
        profileServices,
    };
}

export function useLoginValidation(isOffline: Ref<boolean>) {
    const { $t } = useI18n();
    const nameRules = [(v: unknown) => !!v || $t('user.requireUsername')];
    const emailRules = [
        (v: unknown) => !!v || $t('user.requireEmail'),
        (v: string) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v)
            || $t('user.illegalEmail'),
    ];
    const passwordRules = [(v: unknown) => !!v || $t('user.requirePassword')];
    const usernameRules = computed(() => (isOffline.value
        ? nameRules
        : emailRules));
    const data = reactive({
        usernameErrors: [] as string[],
        passwordErrors: [] as string[],
    });
    function reset() {
        data.usernameErrors = [];
        data.passwordErrors = [];
    }
    function handleError(e: any) {
        const err = e as LoginException;
        if (err.type === 'loginInternetNotConnected') {
            // TODO: handle this case
        } else if (err.type === 'loginInvalidCredentials') {
            const msg = $t('user.invalidCredentials');
            data.usernameErrors = [msg];
            data.passwordErrors = [msg];
        } else {
            console.error(e);
        }
    }
    return {
        ...toRefs(data),
        usernameRules,
        passwordRules,
        reset,
        handleError,
    };
}

export function useUserSecurity() {
    interface MojangChallenge {
        readonly answer: {
            id: number;
            answer: string;
        };
        readonly question: {
            id: number;
            question: string;
        };
    }

    const { offline, security, refreshingSecurity, getChallenges, checkLocation, submitChallenges } = useCurrentUserStatus();
    const data = reactive({
        loading: false,
        challenges: [] as MojangChallenge[],
        error: undefined as any,
    });
    async function check() {
        if (offline.value) return;
        try {
            data.loading = true;
            let sec = await checkLocation();
            if (sec) return;
            try {
                let challenges = await getChallenges();
                data.challenges = challenges.map(c => ({ question: c.question, answer: { id: c.answer.id, answer: '' } }));
            } catch (e) {
                data.error = e;
            }
        } finally {
            data.loading = false;
        }
    }
    async function submit() {
        data.loading = true;
        try {
            await submitChallenges(data.challenges.map(c => c.answer));
        } catch (e) {
            data.error = e;
        } finally {
            data.loading = false;
        }
    }
    onMounted(() => {
        check();
    });
    return {
        ...toRefs(data),
        refreshing: refreshingSecurity,
        security,
        check,
        submit,
    };
}

export function useUserSkin() {

}

