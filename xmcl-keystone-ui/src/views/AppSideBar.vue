<template>
  <v-navigation-drawer
    :value="true"
    permanent
    :mini-variant="true"
    :color="sideBarColor"
    class="sidebar moveable z-10 rounded-lg shadow-lg"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)` }"
  >
    <v-list
      nav
      dense
      class="px-2"
    >
      <!-- <v-list-item
        class="non-moveable"
        @click="goBack"
      >
        <v-icon :size="22">
          arrow_back
        </v-icon>
      </v-list-item> -->

      <v-list-item
        id="my-stuff-button"
        v-shared-tooltip.right="_ => t('myStuff')"
        link
        push
        to="/me"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon :size="22"> home </v-icon>
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
          <v-icon :size="22">store</v-icon>
        </v-list-item-icon>
        <v-list-item-title v-text="t('store.name', 2)" />
      </v-list-item>
    </v-list>

    <v-divider class="mx-2" />

    <AppSideBarContentNext />

    <!-- <v-list
      nav
      dense
      class="px-2"
      style=""
    >
      <v-list-item
        v-shared-tooltip.right="_ => t('multiplayer.name')"
        link
        class="non-moveable"
        @click="goMultiplayer"
      >
        <v-list-item-icon>
          <v-icon :size="22">hub</v-icon>
        </v-list-item-icon>
        <v-list-item-title>{{ t('multiplayer.name') }}</v-list-item-title>
      </v-list-item>
    </v-list> -->

    <!-- <v-divider class="mx-2 block" /> -->

    <v-list
      nav
      dense
      class="px-2"
      style=""
    >

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
            <v-icon :size="22">settings</v-icon>
          </v-badge>
        </v-list-item-icon>
        <v-list-item-title>{{ t('setting.name', 2) }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts setup>
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'
import AppSideBarContentNext from './AppSideBarContentNext.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { kTheme } from '@/composables/theme'

const { blurSidebar } = injection(kTheme)
const { state } = injection(kSettingsState)

const { t } = useI18n()
const { sideBarColor } = injection(kTheme)
const { back } = useRouter()

function goBack() {
  back()
}

</script>

<style scoped>
.sidebar {
  width: 64px !important;
  min-width: 64px !important;
  margin-left: 16px;
  max-height: calc(100% - 16px);
  display: flex;
  flex-direction: column;
  border: none !important;
  /* @apply rounded-r-xl border-r-[hsla(0,0%,100%,.12)]; */
}
</style>
<style>
.sidebar .v-navigation-drawer__border {
  display: none;
}

.sidebar .v-list-item {
  min-width: 48px !important;
  min-height: 48px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.sidebar .v-list-item .v-list-item__icon {
  margin: auto;
}

.sidebar .v-list-item:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.dark .sidebar .theme--dark.v-icon {
  color: var(--icon-color);
}

.dark .sidebar .v-list-item {
  --icon-color: #d8d8d8;
}

.dark .sidebar .v-list-item:hover {
  --icon-color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.v-navigation-drawer__content {
  @apply flex flex-col flex-grow-0 h-full;
}

.sidebar .v-list .v-list-item--active {
  color: var(--color-primary);
}

.sidebar .v-list .v-list-item--active, .v-list .v-list-item--active .v-icon {
  /* color: #4caf50 !important; */
  color: var(--color-primary);
}

.sidebar .v-list-item--link:before {
  @apply text-white;
}

.sidebar .theme--light.v-list-item--active:before {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
}

.avatar .v-list-group__header.v-list-item--active:not(:hover):not(:focus):before {
}
</style>
