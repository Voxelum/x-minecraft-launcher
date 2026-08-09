<template>
  <div class="me-profile-panel flex flex-col h-full overflow-hidden select-none">
    <UserAccountSwitcher class="profile-header px-3 pt-3 pb-2 flex-shrink-0" show-inline-delete />

    <!-- Skin & Cape Card -->
    <div class="skin-cape-card surface-panel mx-3 mt-1 mb-2 flex-shrink-0 overflow-hidden">
      <!-- 3D Model with edit controls -->
      <div
        class="flex items-center justify-center py-3 cursor-default"
      >
        <UserSkin
          :user="userProfile"
          :profile="gameProfile"
          :inspect="false"
        />
      </div>

      <!-- Cape row -->
      <div v-if="capes.length > 0" class="cape-row border-t px-3 py-2.5"
        style="border-color: rgba(var(--v-theme-on-surface), 0.06);"
      >
        <div class="text-[10px] font-semibold uppercase tracking-widest opacity-50 mb-1.5">
          {{ t('userCape.changeTitle') }}
        </div>
        <div
          ref="capeScroller"
          v-roving-tabindex
          role="radiogroup"
          :aria-label="t('userCape.changeTitle')"
          class="cape-scroll flex gap-1.5 overflow-x-auto"
          @wheel.prevent="onCapeWheel"
        >
          <!-- No cape -->
          <div
            v-shared-tooltip.top="() => t('userCape.noCape')"
            class="cape-thumb flex-shrink-0 cursor-pointer rounded-lg border transition-all flex items-center justify-center hover:scale-110 hover:-translate-y-0.5"
            :class="!skinModel.cape.value
              ? 'border-primary bg-primary/15 shadow-sm shadow-primary/20'
              : 'border-transparent hover:border-[rgba(var(--v-theme-on-surface),0.15)] hover:bg-[rgba(var(--v-theme-on-surface),0.05)]'"
            role="radio"
            tabindex="0"
            :aria-checked="!skinModel.cape.value"
            :aria-label="t('userCape.noCape')"
            @click="selectCape(undefined)"
            @keydown.enter.prevent="selectCape(undefined)"
            @keydown.space.prevent="selectCape(undefined)"
          >
            <div class="w-full h-full border border-dashed border-current rounded opacity-30 flex items-center justify-center">
              <v-icon size="12" aria-hidden="true">block</v-icon>
            </div>
          </div>
          <!-- Capes -->
          <div
            v-for="c of capes"
            :key="c.id"
            v-shared-tooltip.top="() => c.alias || c.id"
            class="cape-thumb flex-shrink-0 cursor-pointer rounded-lg border transition-all overflow-hidden hover:scale-110 hover:-translate-y-0.5"
            :class="skinModel.cape.value === c.url
              ? 'border-primary bg-primary/15 shadow-sm shadow-primary/20'
              : 'border-transparent hover:border-[rgba(var(--v-theme-on-surface),0.15)] hover:bg-[rgba(var(--v-theme-on-surface),0.05)]'"
            role="radio"
            tabindex="0"
            :aria-checked="skinModel.cape.value === c.url"
            :aria-label="c.alias || c.id"
            @click="selectCape(c.url)"
            @keydown.enter.prevent="selectCape(c.url)"
            @keydown.space.prevent="selectCape(c.url)"
          >
            <div class="cape-scale-wrapper">
              <PlayerCape :src="c.url" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      class="friends-section flex-shrink-0 px-3 py-3 flex-grow flex flex-col"
      role="region"
      :aria-label="t('minecraftFriends.friends')"
    >
      <template v-if="isMicrosoftUser">
        <!-- Settings row -->
        <div class="surface-card-row rounded-xl overflow-hidden mb-2">
          <div
            class="flex items-center justify-between px-3 py-2"
          >
            <label :for="friendsEnabledId" class="flex items-center gap-2 cursor-pointer">
              <v-icon size="14" class="opacity-50" aria-hidden="true">visibility</v-icon>
              <span class="text-[11px] opacity-70">{{ t('minecraftFriends.privacy.friendsEnabled') }}</span>
            </label>
            <v-switch
              :id="friendsEnabledId"
              :model-value="preferences?.friendsEnabled ?? true"
              color="primary"
              density="compact"
              hide-details
              :loading="preferencesLoading"
              :disabled="preferencesLoading"
              class="flex-shrink-0"
              :aria-label="t('minecraftFriends.privacy.friendsEnabled')"
              @update:model-value="setPreferences({ friendsEnabled: $event as boolean })"
            />
          </div>
        </div>

        <!-- Incoming requests pill -->
        <button
          v-if="incomingCount > 0"
          type="button"
          class="incoming-requests-pill w-full flex items-center gap-2 rounded-xl px-3 py-2 mb-2 cursor-pointer transition-all border hover:border-primary/40"
          style="background: rgba(var(--v-theme-primary), 0.08); border-color: rgba(var(--v-theme-primary), 0.15);"
          :aria-label="t('minecraftFriends.incomingHint', { count: incomingCount })"
          @click="showFriendsDialog"
        >
          <v-icon size="16" color="primary" aria-hidden="true">mail</v-icon>
          <span class="text-xs font-medium flex-grow text-left">
            {{ t('minecraftFriends.incomingHint', { count: incomingCount }) }}
          </span>
          <v-icon size="14" class="opacity-40" aria-hidden="true">chevron_right</v-icon>
        </button>

        <v-menu
          v-model="friendsMenuOpen"
          location="end"
          transition="slide-x-transition"
          :close-on-content-click="false"
          :open-delay="0"
          :close-delay="160"
          open-on-hover
          offset="8"
          content-class="profile-friends-menu"
          :disabled="preferences?.friendsEnabled === false"
        >
          <template #activator="{ props }">
            <div
              v-bind="props"
              data-testid="minecraft-friends-menu-activator"
              class="surface-card-row friends-menu-activator flex items-center justify-between rounded-xl px-3 py-4.5"
              :class="{ 'opacity-50 pointer-events-none': preferences?.friendsEnabled === false }"
              role="button"
              :tabindex="preferences?.friendsEnabled === false ? -1 : 0"
              :aria-label="t('minecraftFriends.friends')"
              aria-haspopup="menu"
              :aria-expanded="friendsMenuOpen"
              :aria-disabled="preferences?.friendsEnabled === false"
            >
              <div class="flex items-center gap-2 min-w-0">
                <v-icon size="14" class="opacity-50" aria-hidden="true">group</v-icon>
                <span class="text-[11px] font-medium opacity-70 truncate">
                  {{ t('minecraftFriends.friends') }}
                </span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <v-badge
                  v-if="incomingCount > 0"
                  color="primary"
                  :content="incomingCount"
                  inline
                />
                <v-progress-circular
                  v-if="friendsLoading"
                  indeterminate
                  size="16"
                  width="2"
                />
                <span
                  v-else
                  class="text-xs opacity-50"
                >
                  {{ friendsData?.friends.length ?? 0 }}
                </span>
                <v-icon v-if="!friendsLoading" size="16" class="opacity-50" aria-hidden="true">chevron_right</v-icon>
              </div>
            </div>
          </template>

          <v-card
            data-testid="minecraft-friends-menu"
            class="rounded-xl overflow-hidden border profile-friends-menu-card"
            style="border-color: rgba(var(--v-theme-on-surface), 0.08);"
          >
            <div class="flex items-center justify-between px-3 py-2">
              <div class="text-[10px] font-semibold uppercase tracking-widest opacity-50">
                {{ t('minecraftFriends.friends') }}
              </div>
              <v-btn
                icon
                variant="text"
                size="x-small"
                :title="t('shared.refresh')"
                :aria-label="t('shared.refresh')"
                :loading="friendsLoading"
                @click="refreshFriends(true)"
              >
                <v-icon size="14" aria-hidden="true">refresh</v-icon>
              </v-btn>
            </div>
            <v-divider />

            <v-list
              density="compact"
              bg-color="transparent"
              class="profile-friends-menu-list py-1"
            >
              <div
                v-if="friendsLoading && !friendsData"
                class="flex items-center justify-center py-6"
              >
                <v-progress-circular
                  indeterminate
                  size="24"
                  width="2"
                />
              </div>
              <div
                v-else-if="friendsData && friendsData.friends.length === 0"
                class="flex flex-col items-center text-center gap-2 py-6 px-4"
              >
                <div class="w-10 h-10 rounded-2xl bg-[rgba(var(--v-theme-primary),0.1)] flex items-center justify-center">
                  <v-icon size="22" color="primary" class="opacity-60" aria-hidden="true">group_add</v-icon>
                </div>
                <div class="text-xs font-semibold opacity-60">{{ t('minecraftFriends.heroEmptyTitle') }}</div>
                <div class="text-[10px] opacity-35 max-w-[220px] leading-relaxed">{{ t('minecraftFriends.heroEmptyHint') }}</div>
              </div>
              <MinecraftFriendRow
                v-for="f of friendsData?.friends ?? []"
                :key="f.profileId"
                :friend="f"
                class="mx-1 rounded-lg"
              >
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  color="error"
                  :title="t('shared.remove')"
                  :aria-label="t('shared.remove')"
                  :loading="removingFriend === f.profileId"
                  @click.stop="onRemoveFriend(f)"
                >
                  <v-icon size="14" aria-hidden="true">person_remove</v-icon>
                </v-btn>
              </MinecraftFriendRow>
            </v-list>
          </v-card>
        </v-menu>

        <div class="flex-grow" />
        <v-btn
          variant="tonal"
          color="primary"
          class="mt-2 rounded-xl flex-grow-0"
          block
          :disabled="preferences?.friendsEnabled === false"
          @click="openFriendsDialog"
        >
          <v-icon start size="16" aria-hidden="true">person_add</v-icon>
          {{ t('minecraftFriends.add') }}
        </v-btn>
      </template>

      <div v-else class="flex flex-col items-center text-center gap-2 py-8 opacity-50">
        <v-icon size="28" aria-hidden="true">lock</v-icon>
        <div class="text-xs">{{ t('minecraftFriends.requiresMicrosoft') }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import MinecraftFriendRow from '@/components/MinecraftFriendRow.vue'
import PlayerCape from '@/components/PlayerCape.vue'
import UserAccountSwitcher from '@/components/UserAccountSwitcher.vue'
import UserSkin from '@/components/UserSkin.vue'
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kMinecraftFriends } from '@/composables/minecraftFriends'
import { kUserContext } from '@/composables/user'
import { UserSkinModel, UserSkinRenderPaused, useUserSkin } from '@/composables/userSkin'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { MinecraftFriendsServiceKey } from '@xmcl/runtime-api'
import type { MinecraftFriend } from '@xmcl/runtime-api'
import { useId } from 'vue'

const { t } = useI18n()

const { userProfile, gameProfile } = injection(kUserContext)
const {
  data: friendsData,
  loading: friendsLoading,
  incomingCount,
  isMicrosoftUser,
  refresh: refreshFriends,
  preferences,
  preferencesLoading,
  setPreferences,
} = injection(kMinecraftFriends)

const paused = inject(UserSkinRenderPaused, ref(false))

const skinModel = useUserSkin(
  computed(() => userProfile.value.id),
  gameProfile,
  computed(() => userProfile.value),
)
provide(UserSkinModel, skinModel)
const capes = computed(() => gameProfile.value?.capes ?? [])
const capeScroller = ref<HTMLElement | null>(null)

function selectCape(url: string | undefined) {
  skinModel.cape.value = url
  skinModel.save()
}

function onCapeWheel(e: WheelEvent) {
  if (capeScroller.value) {
    capeScroller.value.scrollLeft += e.deltaY
  }
}

const { show: showFriendsDialog } = useDialog('minecraft-friends')
const friendsMenuOpen = ref(false)
const friendsEnabledId = useId()

function openFriendsDialog() {
  friendsMenuOpen.value = false
  showFriendsDialog()
}

const friendsService = useService(MinecraftFriendsServiceKey)
const removingFriend = ref<string | undefined>()

async function onRemoveFriend(f: MinecraftFriend) {
  if (!userProfile.value) return
  removingFriend.value = f.profileId
  try {
    await friendsService.removeFriend(userProfile.value, f.profileId)
    await refreshFriends(true)
  } finally {
    removingFriend.value = undefined
  }
}
</script>

<style scoped>
.me-profile-panel {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.6);
  backdrop-filter: blur(12px);
}

.cape-thumb {
  width: 36px;
  height: 52px;
  padding: 3px;
}

.cape-scale-wrapper {
  width: 80px;
  height: 120px;
  transform: scale(0.375);
  transform-origin: top left;
}

.cape-scroll {
  scrollbar-width: none;
}

.cape-scroll::-webkit-scrollbar {
  height: 0;
  display: none;
}

.profile-friends-menu-list {
  max-height: min(360px, calc(100vh - 220px));
  min-height: 56px;
  overflow-y: auto;
}

.incoming-requests-pill {
  background: rgba(var(--v-theme-primary), 0.08);
  color: inherit;
  font: inherit;
  appearance: none;
}

.incoming-requests-pill:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>

<style>
.profile-friends-menu-card {
  width: 300px;
  background: rgba(var(--v-theme-surface), 0.96);
  backdrop-filter: blur(12px);
}
</style>
