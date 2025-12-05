<template>
  <v-navigation-drawer
    v-if="!isHorizontal"
    :value="true"
    permanent
    :mini-variant="true"
    :color="sideBarColor"
    class="sidebar moveable z-10 rounded-[0.75rem]"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)` }"
  >
    <v-list
      nav
      dense
      class="ml-1 px-2"
    >
      <v-list-item
        class="non-moveable"
        @click="goBack"
      >
        <v-icon class="text-[18px]">
          arrow_back
        </v-icon>
      </v-list-item>

      <v-list-item
        id="my-stuff-button"
        v-shared-tooltip.right="_ => t('myStuff')"
        link
        push
        to="/me"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon> widgets </v-icon>
        </v-list-item-icon>
        <v-list-item-title v-text="t('myStuff')" />
      </v-list-item>
      <v-list-item
        v-if="true"
        v-shared-tooltip.right="_ => t('store.name', 2)"
        link
        push
        to="/store"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon
            :size="28"
          >
            store
          </v-icon>
        </v-list-item-icon>
        <v-list-item-title v-text="t('store.name', 2)" />
      </v-list-item>
      <v-divider />
    </v-list>

    <AppSideBarContentNext />

    <v-list
      nav
      dense
      class="ml-1 px-2"
      style=""
    >
      <v-list-item
        v-shared-tooltip.right="_ => t('multiplayer.name')"
        link
        class="non-moveable"
        @click="goMultiplayer"
      >
        <v-list-item-icon>
          <v-icon
            :size="23"
          >
            hub
          </v-icon>
        </v-list-item-icon>
        <v-list-item-title>{{ t('multiplayer.name') }}</v-list-item-title>
      </v-list-item>

      <v-divider
        class="mx-1 block"
      />

      <v-list-item
        v-shared-tooltip.right="_ => t('setting.name', 2)"
        link
        push
        to="/setting"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-badge
            right
            overlap
            :value="state?.updateStatus !== 'none'"
          >
            <template #badge>
              <span>{{ 1 }}</span>
            </template>
            <v-icon>
              settings
            </v-icon>
          </v-badge>
        </v-list-item-icon>
        <v-list-item-title>{{ t('setting.name', 2) }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>

  <div
    v-else
    class="sidebar-horizontal moveable z-10 rounded-[0.75rem] flex flex-row items-center px-2 h-12 mx-2 my-2 elevation-4"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)`, backgroundColor: sideBarColor }"
  >
    <div class="flex flex-row items-center flex-grow-0">
      <v-btn icon class="non-moveable mr-1" @click="goBack">
        <v-icon>arrow_back</v-icon>
      </v-btn>

      <v-btn
        id="my-stuff-button"
        icon
        to="/me"
        class="non-moveable mr-1"
        v-shared-tooltip.bottom="t('myStuff')"
      >
        <v-icon>widgets</v-icon>
      </v-btn>

      <v-btn
        icon
        to="/store"
        class="non-moveable mr-1"
        v-shared-tooltip.bottom="t('store.name', 2)"
      >
        <v-icon :size="28">store</v-icon>
      </v-btn>
      
      <v-divider vertical class="mx-2 h-6" />
    </div>

    <div class="flex-grow-1 overflow-hidden h-full flex items-center relative" style="min-width: 0;">
      <AppSideBarContentNext :horizontal="true" />
    </div>

    <div class="flex flex-row items-center flex-grow-0">
      <v-divider vertical class="mx-2 h-6" />

      <v-btn
        icon
        class="non-moveable mr-1"
        @click="goMultiplayer"
        v-shared-tooltip.bottom="t('multiplayer.name')"
      >
        <v-icon :size="23">hub</v-icon>
      </v-btn>

      <v-btn
        icon
        to="/setting"
        class="non-moveable"
        v-shared-tooltip.bottom="t('setting.name', 2)"
      >
        <v-badge
          right
          overlap
          :value="state?.updateStatus !== 'none'"
        >
          <template #badge>
            <span>{{ 1 }}</span>
          </template>
          <v-icon>settings</v-icon>
        </v-badge>
      </v-btn>
    </div>
  </div>
</template>

<script lang=ts setup>
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'
import AppSideBarContentNext from './AppSideBarContentNext.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { kTheme } from '@/composables/theme'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'

const { blurSidebar } = injection(kTheme)
const { state } = injection(kSettingsState)
const { position } = useInjectSidebarSettings()

const isHorizontal = computed(() => position.value === 'top' || position.value === 'bottom')

const { t } = useI18n()
const { sideBarColor } = injection(kTheme)
const { back } = useRouter()

function goBack() {
  back()
}

function goMultiplayer() {
  windowController.openMultiplayerWindow()
}

</script>

<style scoped>
.sidebar {
  min-width: 80px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  /* @apply rounded-r-xl border-r-[hsla(0,0%,100%,.12)]; */
}
</style>
<style>

.dark .sidebar .v-list-item .theme--dark.v-icon {
  color: var(--icon-color);
}

.dark .sidebar .v-list-item:hover .theme--dark.v-icon {
  color: var(--icon-color-hovered);
}


.v-navigation-drawer__content {
  @apply flex flex-col flex-grow-0 h-full;
}

.sidebar .v-list .v-list-item--active, .v-list .v-list-item--active .v-icon {
  /* color: #4caf50 !important; */
  color: var(--color-primary);
}

.sidebar .v-list-item--link:before {
  @apply text-white;
}

.sidebar .theme--dark.v-list-item--active:hover:before {
  opacity: .5;
}

.sidebar .theme--light.v-list-item--active:before {
  opacity: .25;
  background-color: gray;
}

.avatar .v-list-group__header.v-list-item--active:not(:hover):not(:focus):before {
  opacity: .24;
}
</style>
