<template>
  <v-dialog
    v-model="isShown"
    :width="login || addService ? 500 : 1150"
    :persistent="login || addService"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <!-- Main Macos Window Container -->
    <div
      class="overflow-hidden flex flex-row w-full backdrop-blur-3xl rounded-[32px] border border-white/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 ease-out"
      style="background: rgba(var(--v-theme-surface), 0.85); color: rgb(var(--v-theme-on-surface));"
      :class="{
        'h-[680px]': login || addService,
        'h-[750px]': !login && !addService,
      }"
    >
      <!-- Full-screen overlay for Login / Add Service -->
      <transition name="fade-transition" mode="out-in">
        <template v-if="addService">
          <div
            :key="2"
            class="flex-grow p-6 relative w-full h-full flex flex-col"
          >
            <UserCardAddYggdrasilService
              class="w-full flex-grow"
              @back="onBackFromAddService"
            />
          </div>
        </template>
        <template v-else-if="login">
          <div :key="1" class="flex flex-col w-full h-full relative overflow-y-auto invisible-scroll">
            <div class="absolute top-0 left-0 w-full flex justify-between pt-6 px-6 z-50 pointer-events-none">
              <v-btn
                v-if="users.length > 0"
                icon
                class="transition-colors shadow-none hover:scale-105 active:scale-95 pointer-events-auto"
                style="background: rgba(var(--v-theme-on-surface), 0.05);"
                @click="login = false"
              >
                <v-icon>arrow_back</v-icon>
              </v-btn>
              <div v-else></div>

              <v-btn
                icon
                class="transition-colors shadow-none hover:scale-105 active:scale-95 hover:bg-red-500 hover:text-white pointer-events-auto"
                style="background: rgba(var(--v-theme-on-surface), 0.05);"
                @click="isShown = false"
              >
                <v-icon>close</v-icon>
              </v-btn>
            </div>
            <div
              class="w-full flex justify-center items-start pt-16 px-6 pb-6"
            >
              <UserLoginForm
                :inside="false"
                :options="options"
                class="w-full max-w-md"
                @login="reset()"
                @add-service="onAddService"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <!-- Split Layout -->
          <div :key="0" class="flex flex-row w-full h-full">
            <!-- Left Sidebar: Account List -->
            <div
              class="w-[320px] flex-shrink-0 flex flex-col border-r backdrop-blur-md z-10"
              style="background: rgba(var(--v-theme-on-surface), 0.03); border-color: rgba(var(--v-theme-on-surface), 0.08);"
            >
              <div
                v-if="te('userAccount.accounts')"
                class="px-6 py-6 text-xs font-bold uppercase tracking-widest flex justify-between items-center"
                style="color: rgba(var(--v-theme-on-surface), 0.6);"
              >
                {{ t("userAccount.accounts") }}
              </div>
              <div v-else class="pt-6"></div>
              <div
                class="flex-grow overflow-y-auto px-4 invisible-scroll flex flex-col gap-3 pb-4"
              >
                <div
                  v-for="item of usersToSwitchAndCurrent"
                  :key="item.id"
                  class="group flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-all duration-300 ease-out border"
                  :class="
                    item.id === selected?.id
                      ? 'bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/30 border-transparent transform scale-[1.02]'
                      : 'hover:shadow-md'
                  "
                  :style="item.id !== selected?.id ? 'background: rgba(var(--v-theme-on-surface), 0.05); border-color: rgba(var(--v-theme-on-surface), 0.08);' : ''"
                  @click="onSelectUser(item.id)"
                >
                  <div class="relative flex-shrink-0">
                    <img
                      v-if="item.avatar"
                      :src="item.avatar"
                      class="w-[48px] h-[48px] object-cover rounded-full shadow-inner"
                    />
                    <PlayerAvatar
                      v-else
                      class="overflow-hidden rounded-full shadow-inner"
                      style="background: rgba(var(--v-theme-on-surface), 0.1);"
                      :src="
                        item.profiles[item.selectedProfile]?.textures?.SKIN?.url
                      "
                      :dimension="48"
                    />
                    <div
                      v-if="item.id === selected?.id"
                      class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-[3px] border-white dark:border-[#1a1a1a]"
                    ></div>
                  </div>
                  
                  <div class="flex flex-col flex-grow overflow-hidden">
                    <span
                      class="font-bold text-[15px] truncate transition-colors duration-200"
                      :style="item.id === selected?.id ? '' : 'color: rgba(var(--v-theme-on-surface), 0.9);'"
                    >
                      {{ maskUserName(item.username) }}
                    </span>
                    <div class="flex items-center gap-1.5 mt-0.5 text-xs font-medium" :style="item.id === selected?.id ? 'color: rgba(255,255,255,0.8);' : 'color: rgba(var(--v-theme-on-surface), 0.6);'">
                      <v-icon x-small :style="item.id === selected?.id ? 'color: white;' : 'color: #3b82f6;'">verified</v-icon>
                      <span class="truncate">{{
                        getAuthorityName(item.authority)
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Add Account Button -->
              <div class="p-5 border-t" style="border-color: rgba(var(--v-theme-on-surface), 0.08); background: rgba(var(--v-theme-on-surface), 0.02);">
                <button
                  class="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-primary to-primary hover:from-primary-light hover:to-primary text-white rounded-2xl transition-all duration-300 font-bold shadow-[0_8px_20px_-6px_rgba(var(--v-theme-primary),0.5)] hover:shadow-[0_12px_25px_-6px_rgba(var(--v-theme-primary),0.6)] active:scale-[0.98] transform hover:-translate-y-0.5"
                  @click="login = true"
                >
                  <v-icon size="20">person_add</v-icon>
                  {{ t("userAccount.add") }}
                </button>
              </div>
            </div>

            <!-- Right Panel: Account Details -->
            <div
              class="flex-grow flex flex-col relative bg-transparent overflow-hidden"
            >
              <!-- Top Header Actions -->
              <div class="absolute top-6 right-6 z-20 flex gap-3">
                <v-btn
                  icon
                  class="backdrop-blur-xl border transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                  style="background: rgba(var(--v-theme-on-surface), 0.05); border-color: rgba(var(--v-theme-on-surface), 0.1);"
                  :loading="refreshing"
                  @click="onRefresh(true)"
                >
                  <v-icon size="20">refresh</v-icon>
                </v-btn>
                <v-btn
                  icon
                  color="error"
                  class="transition-all shadow-sm border border-red-500/20 hover:border-red-500 hover:shadow-red-500/30 hover:shadow-lg hover:scale-105 active:scale-95"
                  style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"
                  @click="deleteDialog.show(true)"
                >
                  <v-icon size="20">delete</v-icon>
                </v-btn>
              </div>

              <div class="flex-grow overflow-y-auto invisible-scroll p-10 pb-12">
                <UserCardMicrosoft
                  v-if="selected && selected.authority === AUTHORITY_MICROSOFT"
                  :user="selected"
                />
                <UserCardYggdrasil v-else-if="!!selected" :user="selected" />

                <div
                  v-if="!selected"
                  class="w-full h-full flex flex-col items-center justify-center opacity-40"
                  style="color: rgba(var(--v-theme-on-surface), 0.5);"
                >
                  <v-icon size="80" class="mb-6 drop-shadow-lg">person_off</v-icon>
                  <span class="text-xl font-bold tracking-wide">{{
                    t("userAccount.noAccount")
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </transition>
    </div>

    <!-- Dialogs from original UserCard -->
    <SimpleDialog
      v-model="deleteDialogModel"
      :width="400"
      :title="t('userAccount.removeTitle')"
      @confirm="deleteDialog.confirm"
    >
      {{ t("userAccount.removeDescription") }}
    </SimpleDialog>
  </v-dialog>
</template>

<script lang="ts" setup>
import PlayerAvatar from "@/components/PlayerAvatar.vue";
import SimpleDialog from "@/components/SimpleDialog.vue";
import { useService } from "@/composables";
import { useLocalStorageCacheBool } from "@/composables/cache";
import { useSimpleDialog } from "@/composables/dialog";
import { kUserContext, useUserExpired } from "@/composables/user";
import { injection } from "@/util/inject";
import {
  AUTHORITY_MICROSOFT,
  AUTHORITY_MOJANG,
  AUTHORITY_DEV,
  UserServiceKey,
} from "@xmcl/runtime-api";
import UserCardAddYggdrasilService from "./UserCardAddYggdrasilService.vue";
import UserCardMicrosoft from "./UserCardMicrosoft.vue";
import UserCardYggdrasil from "./UserCardYggdrasil.vue";
import UserLoginForm from "./UserLoginForm.vue";

const props = defineProps<{ value: boolean }>();
const emit = defineEmits(["input"]);

const isShown = computed({
  get: () => props.value,
  set: (val) => emit("input", val),
});

const { t, te } = useI18n();
const { users, select, userProfile: selected } = injection(kUserContext);
const { abortRefresh, refreshUser, removeUser } = useService(UserServiceKey);
const expired = useUserExpired(computed(() => selected.value));

const deleteDialog = useSimpleDialog<boolean>(async () => {
  if (!selected.value) return;
  const isLastOne = users.value.length <= 1;
  await removeUser(selected.value);
  if (isLastOne) {
    login.value = true;
  } else {
    select(users.value[0].id);
  }
});
const deleteDialogModel = deleteDialog.model;
const streamerMode = inject(
  "streamerMode",
  useLocalStorageCacheBool("streamerMode", false)
);

const onSelectUser = (user: string) => {
  select(user);
};
const login = ref(users.value.length === 0);
const addService = ref(false);
const refreshing = ref(false);

const usersToSwitchAndCurrent = computed(() => {
  // Return all users
  return users.value;
});

const getAuthorityName = (authority: string) => {
  switch (authority) {
    case AUTHORITY_MICROSOFT:
      return t("userServices.microsoft.name");
    case AUTHORITY_MOJANG:
      return t("userServices.mojang.name");
    case AUTHORITY_DEV:
      return t("userServices.offline.name");
  }
  return authority;
};

const maskUserName = (input: string) => {
  if (!streamerMode.value || !input) return input;
  // Check if it's a phone number (all digits, optionally with + prefix)
  const isPhoneNumber = /^\+?\d+$/.test(input);
  if (isPhoneNumber) {
    if (input.length <= 4) return input;
    return input.slice(0, 3) + "***" + input.slice(-2);
  }

  // Mask email
  const atIndex = input.indexOf("@");
  if (atIndex === -1) return input;
  const prefix = input.slice(0, atIndex);
  const suffix = input.slice(atIndex);
  return prefix.slice(0, 2) + "***" + suffix;
};

async function onRefresh(force = false) {
  refreshing.value = true;
  try {
    if (users.value.length === 0) {
      login.value = true;
      return;
    }
    if (!selected.value?.id) {
      select(users.value[0].id);
    }
    if (selected.value?.id || selected.value?.invalidated || expired.value) {
      // Try to refresh
      const authority = selected.value?.authority;
      await refreshUser(selected.value.id, {
        silent: false,
        force,
      }).catch((e) => {
        console.error(e);
        reset({
          username: selected.value?.username,
          authority,
          error: t("login.userRelogin"),
        });
        login.value = true;
      });
    }
  } finally {
    refreshing.value = false;
  }
}

const options = ref(undefined as any);
const reset = (o?: {
  username?: string;
  password?: string;
  microsoftUrl?: string;
  authority?: string;
  error?: string;
}) => {
  options.value = o;
  login.value = false;
  addService.value = false;
};

const onAddService = () => {
  addService.value = true;
  login.value = false;
};

const onBackFromAddService = () => {
  addService.value = false;
  login.value = true;
};

watch(isShown, (v) => {
  if (!v) return;
  if (users.value.length === 0) {
    login.value = true;
  } else {
    login.value = false;
  }
  addService.value = false;
});
</script>

<style scoped>
/* Vuetify dialog override */
:deep(.v-dialog) {
  box-shadow: none !important;
  border-radius: 24px;
}
</style>
