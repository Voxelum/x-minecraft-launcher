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
      <v-list-group
        v-model="expanding"
        active-class="v-list-item--link"
        class="non-moveable avatar"
      >
        <template #activator>
          <v-tooltip
            color="black"
            transition="scroll-x-transition"
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-list-item-icon v-on="tooltip">
                <v-icon> widgets </v-icon>
              </v-list-item-icon>
            </template>
            {{ t('myStuff') }}
          </v-tooltip>
        </template>

        <v-tooltip
          color="black"
          transition="scroll-x-transition"
          :close-delay="0"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item
              link
              push
              to="/version-setting"
              class="non-moveable"
              v-on="tooltip"
            >
              <v-list-item-icon>
                <v-icon
                  :size="28"
                >
                  power
                </v-icon>
              </v-list-item-icon>
              <v-list-item-title v-text="'Text'" />
            </v-list-item>
          </template>
          {{ t('localVersion.title') }}
        </v-tooltip>

        <v-tooltip
          color="black"
          transition="scroll-x-transition"
          :close-delay="0"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item
              link
              push
              to="/modpack-setting"
              class="non-moveable"
              v-on="tooltip"
            >
              <v-list-item-icon>
                <v-icon> inventory </v-icon>
              </v-list-item-icon>
              <v-list-item-title v-text="'Text'" />
            </v-list-item>
          </template>
          {{ t('modpack.name', 2) }}
        </v-tooltip>

        <v-tooltip
          v-if="sideBarShowCurseforge"
          color="black"
          transition="scroll-x-transition"
          :close-delay="0"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item
              link
              class="non-moveable"
              @click="goToCurseforge()"
              v-on="tooltip"
            >
              <v-list-item-icon>
                <v-icon
                  :size="28"
                  class="mr-0.5"
                >
                  $vuetify.icons.curseforge
                </v-icon>
              </v-list-item-icon>
              <v-list-item-title>Curseforge</v-list-item-title>
            </v-list-item>
          </template>
          Curseforge
        </v-tooltip>

        <v-tooltip
          v-if="sideBarShowModrinth"
          color="black"
          transition="scroll-x-transition"
          :close-delay="0"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item
              link
              class="non-moveable"
              @click="goToModrinth()"
              v-on="tooltip"
            >
              <v-list-item-icon>
                <v-icon>
                  $vuetify.icons.modrinth
                </v-icon>
              </v-list-item-icon>
              <v-list-item-title>Modrinth</v-list-item-title>
            </v-list-item>
          </template>
          Modrinth
        </v-tooltip>

        <v-tooltip
          v-if="sideBarShowFtb"
          color="black"
          transition="scroll-x-transition"
          :close-delay="0"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item
              link
              class="non-moveable"
              @click="goToFtb()"
              v-on="tooltip"
            >
              <v-list-item-icon>
                <v-icon>
                  $vuetify.icons.ftb
                </v-icon>
              </v-list-item-icon>
              <v-list-item-title>FTB</v-list-item-title>
            </v-list-item>
          </template>
          Feed the Beast
        </v-tooltip>
      </v-list-group>
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
              <v-icon
                :size="23"
              >
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
        </template>
        {{ t('setting.name', 2) }}
      </v-tooltip>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts setup>
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kSettingsState } from '@/composables/setting'
import { kMarketRoute } from '@/composables/useMarketRoute'
import { injection } from '@/util/inject'
import { useBarBlur } from '../composables/background'
import { kColorTheme } from '../composables/colorTheme'
import { kUILayout } from '../composables/uiLayout'
import AppSideBarContentFocus from './AppSideBarContentFocus.vue'
import AppSideBarContentNext from './AppSideBarContentNext.vue'

const { blurSidebar } = useBarBlur()
const layout = injection(kUILayout)
const useFocus = computed(() => layout.value === 'focus')
const { state } = injection(kSettingsState)

const sideBarShowCurseforge = useLocalStorageCacheBool('sideBarShowCurseforge', true)
const sideBarShowModrinth = useLocalStorageCacheBool('sideBarShowModrinth', true)
const sideBarShowFtb = useLocalStorageCacheBool('sideBarShowFtb', true)

const { t } = useI18n()
const { sideBarColor } = injection(kColorTheme)
const { push, back, currentRoute } = useRouter()
const expanding = ref(false)

const navToMe = () => {
  if (currentRoute.path !== 'me') {
    push('/me')
  }
}

const { goToCurseforge, goToModrinth, goToFtb } = injection(kMarketRoute)

function goBack() {
  back()
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

.avatar .v-list-group__header.v-list-item--active:not(:hover):not(:focus):before {
  opacity: .24;
}
</style>
