<template>
  <Hint
    v-if="showDropHint"
    icon="save_alt"
    :text="t('login.dropHint').toString()"
  />

  <div
    v-else
    class="w-full h-full max-w-[360px] mx-auto flex flex-col justify-center items-center py-6 px-2"
  >
    <div class="w-full flex flex-col gap-4 relative">
      <div class="w-full text-left self-start relative">
        <label
          class="block text-xs font-semibold text-gray-500/80 uppercase tracking-widest mb-1.5 px-1"
        >
          {{ t("user.authMode") }}
        </label>
        <div
          class="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl cursor-pointer flex items-center justify-between hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          @click.stop="authDropdownOpen = !authDropdownOpen"
        >
          <div class="flex items-center gap-3">
            <template
              v-if="
                isElyBy(currentAuthItem?.text) ||
                isElyBy(currentAuthItem?.value)
              "
            >
              <div
                class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-[#0070c9] rounded-md flex items-center justify-center text-white font-bold text-[11px] shadow-sm"
              >
                E
              </div>
            </template>
            <template
              v-else-if="
                isLittleSkin(currentAuthItem?.text) ||
                isLittleSkin(currentAuthItem?.value)
              "
            >
              <div
                class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-[#8b5cf6] rounded-md flex items-center justify-center text-white font-bold text-[11px] shadow-sm"
              >
                L
              </div>
            </template>
            <template v-else-if="isMicrosoft(currentAuthItem?.value)">
              <div
                class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] bg-white rounded-md shadow-sm"
              >
                <div class="bg-[#F25022] rounded-[1px]"></div>
                <div class="bg-[#7FBA00] rounded-[1px]"></div>
                <div class="bg-[#00A4EF] rounded-[1px]"></div>
                <div class="bg-[#FFB900] rounded-[1px]"></div>
              </div>
            </template>
            <template v-else-if="isOfflineMode(currentAuthItem?.value)">
              <div
                class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-gray-600 dark:bg-gray-700 rounded-md flex items-center justify-center shadow-sm"
              >
                <v-icon size="14" color="white">person_off</v-icon>
              </div>
            </template>
            <template v-else-if="currentAuthItem?.icon?.startsWith('http')">
              <v-img
                :src="currentAuthItem?.icon"
                class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] object-contain bg-white/80 dark:bg-white p-[2px] rounded-md shadow-sm"
              />
            </template>
            <template v-else>
              <div
                class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-md flex items-center justify-center shadow-sm"
              >
                <v-icon size="14" class="opacity-80">{{
                  currentAuthItem?.icon || "vpn_key"
                }}</v-icon>
              </div>
            </template>

            <span class="font-medium text-sm">{{
              currentAuthItem?.text || currentAuthItem?.value
            }}</span>
          </div>
          <v-icon
            :class="{ 'rotate-180': authDropdownOpen }"
            class="transition-transform duration-200"
            >arrow_drop_down</v-icon
          >
        </div>

        <transition name="fade-transition">
          <div
            v-show="authDropdownOpen"
            class="absolute z-[100] mt-2 w-full bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-xl shadow-xl overflow-hidden py-1"
          >
            <div
              v-for="item in items"
              :key="item.value"
              class="w-full px-4 py-3 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 cursor-pointer flex items-center gap-3 transition-colors"
              @click="
                authority = item.value;
                authDropdownOpen = false;
              "
            >
              <template v-if="isElyBy(item.text) || isElyBy(item.value)">
                <div
                  class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-[#0070c9] rounded-md flex items-center justify-center text-white font-bold text-[11px] shadow-sm"
                >
                  E
                </div>
              </template>
              <template
                v-else-if="isLittleSkin(item.text) || isLittleSkin(item.value)"
              >
                <div
                  class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-[#8b5cf6] rounded-md flex items-center justify-center text-white font-bold text-[11px] shadow-sm"
                >
                  L
                </div>
              </template>
              <template v-else-if="isMicrosoft(item.value)">
                <div
                  class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] bg-white rounded-md shadow-sm"
                >
                  <div class="bg-[#F25022] rounded-[1px]"></div>
                  <div class="bg-[#7FBA00] rounded-[1px]"></div>
                  <div class="bg-[#00A4EF] rounded-[1px]"></div>
                  <div class="bg-[#FFB900] rounded-[1px]"></div>
                </div>
              </template>
              <template v-else-if="isOfflineMode(item.value)">
                <div
                  class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-gray-600 dark:bg-gray-700 rounded-md flex items-center justify-center shadow-sm"
                >
                  <v-icon size="14" color="white">person_off</v-icon>
                </div>
              </template>
              <template v-else-if="item.icon?.startsWith('http')">
                <v-img
                  :src="item.icon"
                  class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] object-contain bg-white/80 dark:bg-white p-[2px] rounded-md shadow-sm"
                />
              </template>
              <template v-else>
                <div
                  class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-md flex items-center justify-center shadow-sm"
                >
                  <v-icon size="14" class="opacity-80">{{
                    item.icon || "vpn_key"
                  }}</v-icon>
                </div>
              </template>

              <span class="font-medium text-sm">{{ item.text }}</span>
            </div>

            <div class="w-full h-[1px] bg-black/5 dark:bg-white/5 my-1"></div>

            <div
              v-if="developerMode"
              class="w-full px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors text-primary"
              @click="
                $emit('add-service');
                authDropdownOpen = false;
              "
            >
              <div
                class="flex-none w-5 h-5 min-w-[20px] max-w-[20px] bg-primary/10 rounded-md flex items-center justify-center shadow-sm"
              >
                <v-icon size="16" color="primary">add</v-icon>
              </div>
              <span class="font-medium text-sm">{{
                t("userService.add")
              }}</span>
            </div>
          </div>
        </transition>
      </div>

      <transition name="fade-transition">
        <div
          v-if="errorMessage"
          class="w-full bg-red-500/10 border border-red-500/30 text-red-500 text-sm px-4 py-3 rounded-xl flex items-start gap-2 backdrop-blur-sm"
        >
          <v-icon size="18" color="error">error_outline</v-icon>
          <span class="flex-1">{{ errorMessage }}</span>
        </div>
      </transition>

      <div
        class="w-full flex items-center px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
      >
        <v-icon size="18" class="text-gray-500 mr-2 flex-shrink-0"
          >person</v-icon
        >
        <template v-if="!streamerMode">
          <input
            ref="accountInput"
            v-model="data.username"
            list="login-history"
            class="w-full bg-transparent text-center outline-none text-sm dark:text-gray-200 placeholder:text-gray-500"
            :placeholder="getUserServiceAccount(authority)"
            @input="error = undefined"
            @keypress="error = undefined"
            @keypress.enter="() => onLogin()"
          />
          <datalist id="login-history">
            <option v-for="h in history" :key="h" :value="h" />
          </datalist>
        </template>

        <template v-else>
          <input
            ref="accountInput"
            v-model="data.username"
            type="password"
            class="w-full bg-transparent text-center outline-none text-sm dark:text-gray-200 placeholder:text-gray-500"
            :placeholder="getUserServiceAccount(authority)"
            @input="error = undefined"
            @keypress="error = undefined"
            @keypress.enter="() => onLogin()"
          />
        </template>
      </div>

      <div
        v-if="!isOffline"
        class="w-full flex items-center px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
      >
        <v-icon size="18" class="text-gray-500 mr-2 flex-shrink-0">lock</v-icon>
        <input
          v-model="data.password"
          :type="passwordType"
          :disabled="isPasswordDisabled"
          :readonly="isPasswordReadonly"
          class="w-full bg-transparent text-center outline-none text-sm dark:text-gray-200 disabled:opacity-50 placeholder:text-gray-500"
          :placeholder="passwordPlaceholder"
          @input="error = undefined"
          @keypress.enter="() => onLogin()"
        />
      </div>

      <div
        v-else
        class="w-full flex items-center px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
      >
        <v-icon size="18" class="text-gray-500 mr-2 flex-shrink-0"
          >fingerprint</v-icon
        >
        <input
          v-model="data.uuid"
          type="text"
          class="w-full bg-transparent text-center outline-none text-sm dark:text-gray-200 placeholder:text-gray-500"
          :placeholder="uuidLabel"
          @keypress.enter="() => onLogin()"
        />
      </div>

      <div v-if="allowDeviceCode" class="w-full flex items-center mt-2">
        <label
          class="flex items-center gap-3 cursor-pointer text-sm text-gray-700 dark:text-gray-300 group select-none w-max"
        >
          <div
            class="w-[20px] h-[20px] flex-shrink-0 flex items-center justify-center rounded border transition-all duration-200"
            :class="
              data.useDeviceCode
                ? 'primary border-primary shadow-sm'
                : 'bg-black/10 border-black/30 dark:bg-white/10 dark:border-white/30 group-hover:border-primary/50'
            "
          >
            <v-icon
              v-show="data.useDeviceCode"
              size="16"
              color="white"
              class="font-bold"
              >check</v-icon
            >
          </div>
          <input v-model="data.useDeviceCode" type="checkbox" class="hidden" />
          <span
            class="font-medium group-hover:text-primary transition-colors duration-200"
          >
            {{ t("userServices.microsoft.useDeviceCode") }}
          </span>
        </label>
      </div>

      <div
        class="w-full mt-4"
        @mouseenter="onMouseEnterLogin"
        @mouseleave="onMouseLeaveLogin"
      >
        <v-btn
          block
          :loading="isLogining && !hovered"
          color="primary"
          class="text-white rounded-xl font-bold tracking-widest bg-primary px-6"
          elevation="2"
          large
          :disabled="isLogining && !hovered"
          @click="() => onLogin()"
        >
          <template v-if="!isLogining">
            {{ t("login.login") }}
          </template>
          <template v-else>
            <v-icon>close</v-icon>
            <span v-if="hovered" class="ml-2">Cancel</span>
          </template>
        </v-btn>
        <slot />
      </div>

      <div v-if="data.verificationUri" class="w-full mt-4 text-center">
        <a
          :href="data.verificationUri"
          class="text-sm text-primary hover:text-primary-dark underline decoration-dashed transition-colors font-medium break-all"
          target="_blank"
        >
          {{ t("login.manualLoginUrl") }}
        </a>
      </div>

      <div
        class="w-full mt-2 flex flex-col items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500"
      >
        <a
          v-if="authority === AUTHORITY_MICROSOFT"
          target="browser"
          href="https://my.minecraft.net/en-us/password/forgot/"
          class="hover:text-primary transition-colors hover:underline"
        >
          {{ t("login.forgetPassword") }}
        </a>
        <div v-if="signUpLink" class="flex flex-col items-center gap-1">
          <a
            target="browser"
            :href="signUpLink"
            class="hover:text-primary transition-colors hover:underline"
          >
            {{ t("login.signup") }} / {{ t("login.signupDescription") }}
          </a>
          <a
            v-if="developerMode"
            @click.stop="$emit('add-service')"
            class="hover:text-primary transition-colors hover:underline cursor-pointer"
          >
            {{ manageAuthorityLabel }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Hint from "@/components/Hint.vue";
import { useRefreshable, useService } from "@/composables";
import { useLocalStorageCacheBool } from "@/composables/cache";
import { kSupportedAuthorityMetadata } from "@/composables/yggrasil";
import { injection } from "@/util/inject";
import {
  AUTHORITY_DEV,
  AUTHORITY_MICROSOFT,
  AUTHORITY_MOJANG,
  UserException,
  UserServiceKey,
  isException,
} from "@xmcl/runtime-api";
import { Ref, computed, inject, nextTick, reactive, ref, watch } from "vue";
import {
  useAccountSystemHistory,
  useAuthorityItems,
} from "../composables/login";
import { kUserContext, useLoginValidation } from "../composables/user";
import { kSettingsState } from "@/composables/setting";

const props = defineProps<{
  inside: boolean;
  options?: {
    username?: string;
    password?: string;
    microsoftUrl?: string;
    authority?: string;
    error?: string;
  };
}>();

const emit = defineEmits(["seed", "login", "add-service"]);
const streamerMode = inject(
  "streamerMode",
  useLocalStorageCacheBool("streamerMode", false)
);

const { t } = useI18n();
const { select } = injection(kUserContext);
const { login, abortLogin, on } = useService(UserServiceKey);
const { state: setting } = injection(kSettingsState);

const isElyBy = (val?: string) => !!val && val.toLowerCase().includes("ely.by");
const isLittleSkin = (val?: string) =>
  !!val && val.toLowerCase().includes("littleskin");
const isMicrosoft = (val?: string) => val === AUTHORITY_MICROSOFT;
const isOfflineMode = (val?: string) => val === AUTHORITY_DEV;

const developerMode = computed(() => setting.value?.developerMode ?? false);

const data = reactive({
  username: "",
  password: "",
  uuid: "",
  useDeviceCode: false,
  useFast: false,
  verificationUri: "",
});

const isOffline = computed(() => authority.value === AUTHORITY_DEV);
const isLogining = ref(false);

const getUserServiceAccount = (serv: string) => {
  if (serv === AUTHORITY_MICROSOFT) return t("userServices.microsoft.account");
  if (serv === AUTHORITY_MOJANG) return t("userServices.mojang.account");
  if (serv === AUTHORITY_DEV) return t("userServices.offline.account");
  return t("userServices.mojang.account");
};

const { data: services } = injection(kSupportedAuthorityMetadata);
const rawItems = useAuthorityItems(services);

const items = computed(() => {
  const unique = new Map();
  for (const item of rawItems.value) {
    if (!item.text || item.text.trim() === "") continue;
    if (!unique.has(item.text)) {
      unique.set(item.text, item);
    }
  }
  return Array.from(unique.values());
});

const { authority, history } = useAccountSystemHistory();

const authDropdownOpen = ref(false);
const currentAuthItem = computed(() => {
  return items.value.find((i) => i.value === authority.value) || items.value[0];
});

const currentAccountSystem = computed(() => {
  return services.value?.find((a) => a.authority === authority.value);
});

const signUpLink = computed(() => {
  const sys = currentAccountSystem.value;
  if (sys?.authority === AUTHORITY_MICROSOFT)
    return "https://account.live.com/registration";
  const url = sys?.authlibInjector?.meta.links.register;
  return url || "";
});

const manageAuthorityLabel = computed(() => t("userService.manageServices"));

const allowDeviceCode = computed(() => {
  return (
    authority.value === AUTHORITY_MICROSOFT &&
    currentAccountSystem.value?.flow.includes("device-code")
  );
});

const emailOnly = computed(() => {
  if (!currentAccountSystem.value?.authlibInjector) {
    if (authority.value === AUTHORITY_MICROSOFT) {
      return true;
    }
  }
  return false;
});

const isPasswordReadonly = computed(
  () =>
    !currentAccountSystem.value?.flow.includes("password") || data.useDeviceCode
);
const isPasswordDisabled = computed(
  () => isPasswordReadonly.value && !data.useDeviceCode
);
const passwordType = computed(() => (data.useDeviceCode ? "text" : "password"));

const passwordPlaceholder = computed(() => {
  if (data.useDeviceCode) return t("userServices.microsoft.deviceCodeHint");
  if (authority.value === AUTHORITY_MICROSOFT)
    return t("userServices.microsoft.password");
  if (authority.value === AUTHORITY_DEV)
    return t("userServices.offline.password");
  return t("userServices.mojang.password");
});

const uuidLabel = computed(() => t("userServices.offline.uuid"));

on("microsoft-authorize-url", (url) => {
  data.verificationUri = url;
});

on("device-code", (code) => {
  data.password = code.userCode;
  data.verificationUri = code.verificationUri;
});

const { usernameRules, passwordRules } = useLoginValidation(emailOnly);

const errorMessage = computed(() => {
  const e = error.value;
  if (isException(UserException, e)) {
    if (e.exception.type === "loginInvalidCredentials") {
      return t("loginError.invalidCredentials");
    }
    if (e.exception.type === "loginInternetNotConnected") {
      return t("loginError.badNetworkOrServer");
    }
    if (e.exception.type === "loginGeneral") {
      if (e.message) {
        return e.message;
      }
      return t("loginError.requestFailed");
    }
    if (e.exception.type === "fetchMinecraftProfileFailed") {
      if (
        e.exception.errorType === "ProfileNotFoundError" &&
        !e.exception.developerMessage
      ) {
        return t("loginError.noProfileForNewUser");
      }
      return t("loginError.fetchMinecraftProfileFailed", {
        reason: `${e.exception.errorType}, ${e.exception.developerMessage}`,
      });
    }
    if (e.exception.type === "userCheckGameOwnershipFailed") {
      return t("loginError.checkOwnershipFailed");
    }
    if (e.exception.type === "userExchangeXboxTokenFailed") {
      if (e.exception.reason === "BAD_AGE") {
        return t("loginError.loginXboxAgeRestricted");
      }
      return t("loginError.loginXboxFailed");
    }
    if (e.exception.type === "userLoginMinecraftByXboxFailed") {
      return t("loginError.loginMinecraftByXboxFailed");
    }
    if (e.exception.type === "loginReset") {
      return t("loginError.connectionReset");
    }
    if (e.exception.type === "loginTimeout") {
      return t("loginError.timeout");
    }
    if (e.exception.type === "userAcquireMicrosoftTokenFailed") {
      return t("loginError.acquireMicrosoftTokenFailed");
    }

    if (e.message) {
      return e.message;
    }
  }

  if (e && typeof (e as Error).message === "string") {
    return (e as Error).message;
  }

  return e ? t("loginError.requestFailed") : "";
});

const accountInput: Ref<any> = ref(null);

const { refresh: onLogin, error } = useRefreshable(async () => {
  error.value = undefined;
  accountInput.value.blur();
  await nextTick();
  if (isLogining.value) {
    await abortLogin();
    return;
  }

  for (const rule of usernameRules.value) {
    const err = rule(data.username);
    if (err !== true) {
      throw new Error(err);
    }
  }

  if (!isPasswordReadonly.value && !isPasswordDisabled.value) {
    for (const rule of passwordRules) {
      const err = rule(data.password);
      if (err !== true) {
        throw new Error(err);
      }
    }
  }

  const index = history.value.indexOf(data.username);
  if (index === -1) {
    history.value = [data.username, ...history.value];
  }
  isLogining.value = true;
  const profile = await login({
    username: data.username,
    password: data.password,
    authority: authority.value,
    properties: {
      mode: data.useDeviceCode ? "device" : "",
      uuid: data.uuid,
    },
  }).finally(() => {
    isLogining.value = false;
  });
  select(profile.id);
  emit("login", profile);
});

watch(authority, () => {
  emit("seed");
});

const showDropHint = computed(
  () => allowDeviceCode.value && props.inside && isLogining.value
);

const hovered = ref(false);

const onMouseEnterLogin = () => {
  hovered.value = true;
};

const onMouseLeaveLogin = () => {
  hovered.value = false;
};

watch(
  () => props.options,
  (options) => {
    if (!options) {
      data.username = history.value[0] ?? "";
      data.password = "";
      data.verificationUri = "";
      error.value = undefined;
    } else {
      data.username = options?.username ?? data.username;
      data.verificationUri = "";
      authority.value = options?.authority ?? authority.value;
      error.value = undefined;
    }
  },
  { immediate: true }
);
</script>

<style>
.input-group {
  padding-top: 5px;
}

.password {
  padding-top: 5px;
}

.input-group--text-field label {
  top: 5px;
}

.login-card {
  padding-bottom: 25px;
}

.login-card .v-card__text {
  padding-left: 50px;
  padding-right: 50px;
  padding-bottom: 0px;
}
</style>
