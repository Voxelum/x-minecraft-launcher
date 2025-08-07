<template>
  <v-navigation-drawer
    permanent
    :model-value="true"
    rail
    :color="sideBarColor"
    :width="80"
    class="sidebar moveable z-10!"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)` }"
  >
    <v-list
      nav
      density="compact"
      class="flex-grow-1"
    >
      <v-list-item
        class="non-moveable"
        @click="goBack"
      >
        <v-icon>
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
        value="my-stuff-button"
      >
        <v-icon>
          widgets
        </v-icon>
      </v-list-item>
      <v-list-item
        v-if="true"
        v-shared-tooltip.right="_ => t('store.name', 2)"
        link
        push
        to="/store"
        class="non-moveable"
      >
        <v-icon>
          store
        </v-icon>
      </v-list-item>
      <v-divider />
    </v-list>

    <AppSideBarContent
      class="gap-1 flex-grow-0 flex-shrink-100 justify-start overflow-auto px-2"
    />

    <v-list
      nav
      density="compact"
      class="flex-grow-1"
    >
      <v-list-item
        v-shared-tooltip.right="_ => t('multiplayer.name')"
        link
        class="non-moveable"
        @click="goMultiplayer"
      >
        <v-icon>
          hub
        </v-icon>
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
        <v-badge
          location="right"
          :model-value="state?.updateStatus !== 'none'"
        >
          <template #badge>
            <span>{{ 1 }}</span>
          </template>
          <v-icon>
            settings
          </v-icon>
        </v-badge>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts setup>
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import AppSideBarContent from './AppSideBarContent.vue'

const { blurSidebar } = injection(kTheme)
const { state } = injection(kSettingsState)

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

.dark .sidebar .theme--dark.v-icon {
  color: var(--icon-color);
}

.dark .sidebar .v-list-item {
  --icon-color: #d8d8d8;
}

.dark .sidebar .v-list-item:hover {
  --icon-color: #fff;
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

.sidebar .v-list-item__spacer {
  display: none;
  position: absolute;
}

.sidebar .v-list-item__content {
  align-items: center;
  justify-content: center;
  display: flex;
}
</style>
