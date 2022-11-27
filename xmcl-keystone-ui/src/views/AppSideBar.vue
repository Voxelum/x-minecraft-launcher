<template>
  <v-navigation-drawer
    :value="true"
    permanent
    width="200"
    :mini-variant="true"
    :color="sideBarColor"
    class="sidebar z-10 moveable"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)` }"
  >
    <v-list
      nav
      dense
      class="px-2 ml-1"
    >
      <v-tooltip
        color="black"
        transition="scroll-x-transition"
        :close-delay="0"
        right
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            class="px-2 flex-grow-0 flex-1 non-moveable"
            link
            push
            to="/me"
            v-on="tooltip"
          >
            <v-list-item-avatar
              size="48"
              class="hover:rounded-xl transition-all duration-300"
              large
            >
              <PlayerAvatar
                :src="gameProfile.textures.SKIN.url"
                :dimension="48"
              />
            </v-list-item-avatar>

            <v-list-item-title>{{ gameProfile.name }}</v-list-item-title>
          </v-list-item>
        </template>
        {{ t('myStuff') }}
      </v-tooltip>
    </v-list>

    <AppSideBarContentFocus v-if="useFocus" />
    <AppSideBarContentNext v-else />

    <v-list
      nav
      dense
      class="px-2 ml-1"
      style=""
    >
      <v-tooltip
        :close-delay="0"
        right
        color="black"
        transition="scroll-x-transition"
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            push
            link
            class="non-moveable"
            to="/multiplayer"
            v-on="tooltip"
          >
            <v-list-item-icon>
              <v-icon>
                hub
              </v-icon>
            </v-list-item-icon>
            <v-list-item-title>Multiplayer</v-list-item-title>
          </v-list-item>
        </template>
        {{ t('multiplayer.name') }}
      </v-tooltip>

      <v-divider
        class="mx-1 block"
      />
      <v-tooltip
        :close-delay="0"
        right
        color="black"
        transition="scroll-x-transition"
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            link
            push
            to="/setting"
            class="non-moveable"
            v-on="tooltip"
          >
            <v-list-item-icon>
              <v-badge
                right
                overlap
                :value="state.updateStatus !== 'none'"
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
        </template>
        {{ t('setting.name', 2) }}
      </v-tooltip>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { BaseServiceKey } from '@xmcl/runtime-api'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import { useBarBlur } from '../composables/background'
import { useColorTheme } from '../composables/colorTheme'
import { useCurrentUser } from '../composables/user'
import AppSideBarContentFocus from './AppSideBarContentFocus.vue'
import AppSideBarContentNext from './AppSideBarContentNext.vue'

const { state } = useService(BaseServiceKey)
const { gameProfile } = useCurrentUser()
const { blurSidebar } = useBarBlur()
const useFocus = computed(() => state.layout === 'focus')

const { t } = useI18n()
const { sideBarColor } = useColorTheme()

</script>

<style scoped>
.sidebar {
  min-width: 80px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

</style>
<style>

.v-navigation-drawer__content {
  @apply flex flex-col flex-grow-0 h-full;
}

.sidebar .v-list .v-list-item--active, .v-list .v-list-item--active .v-icon {
  /* color: #4caf50 !important; */
  color: var(--primary);
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
</style>
