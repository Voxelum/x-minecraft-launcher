<template>
  <v-navigation-drawer
    :value="true"
    permanent
    width="200"
    :mini-variant="true"
    :color="sideBarColor"
    class="sidebar moveable z-10"
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
        <v-list-item-title v-text="'Text'" />
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
        <v-list-item-title v-text="'Text'" />
      </v-list-item>
      <v-divider />
    </v-list>

    <AppSideBarContentFocus v-if="useFocus" />
    <AppSideBarContentNext v-else />

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
        <v-list-item-title>Multiplayer</v-list-item-title>
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
        <v-list-item-title>Settings</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts setup>
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'
import { kUILayout } from '../composables/uiLayout'
import AppSideBarContentFocus from './AppSideBarContentFocus.vue'
import AppSideBarContentNext from './AppSideBarContentNext.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { kTheme } from '@/composables/theme'

const { blurSidebar } = injection(kTheme)
const layout = injection(kUILayout)
const useFocus = computed(() => layout.value === 'focus')
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
