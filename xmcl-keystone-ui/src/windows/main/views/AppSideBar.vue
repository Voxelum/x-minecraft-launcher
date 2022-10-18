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
      v-context-menu="items"
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
      <v-tooltip
        v-if="sideBarShowCurseforge"
        color="black"
        transition="scroll-x-transition"
        :close-delay="0"
        right
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            push
            link
            class="non-moveable"
            to="/curseforge/mc-mods"
            v-on="tooltip"
          >
            <v-list-item-icon>
              <v-icon>
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
            push
            link
            class="non-moveable"
            to="/modrinth"
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
            push
            link
            class="non-moveable"
            to="/ftb"
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
    </v-list>

    <v-divider class="!block mx-4" />
    <v-list
      nav
      dense
      class="px-2 ml-1 overflow-auto justify-start flex-grow-0"
    >
      <AppSideBarInstanceItem
        v-for="(i, index) of instances"
        :key="i.path+'-'+index"
        :instance="i"
        @drop="setToPrevious($event, i.path)"
      />

      <v-list-item
        push
        class="non-moveable"
        @click="showAddInstance()"
      >
        <v-tooltip
          :close-delay="0"
          color="black"
          transition="scroll-x-transition"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item-avatar
              size="48"
              class="hover:rounded-xl transition-all duration-300 bg-[rgba(80,80,80,0.4)] hover:bg-green-500"
              large
              v-on="tooltip"
            >
              <v-icon class="text-3xl">
                add
              </v-icon>
            </v-list-item-avatar>
          </template>
          {{ t('instances.add') }}
        </v-tooltip>

        <v-list-item-title>Instance</v-list-item-title>
      </v-list-item>

      <v-list-item
        push
        class="non-moveable"
        @click="showAddServerDialog()"
      >
        <v-tooltip
          :close-delay="0"
          color="black"
          transition="scroll-x-transition"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item-avatar
              size="48"
              class="hover:rounded-xl transition-all duration-300 bg-[rgba(80,80,80,0.4)] hover:bg-green-500"
              large
              v-on="tooltip"
            >
              <v-badge
                right
                color="transparent"
                bottom
                overlap
                offset-x="13"
                offset-y="17"
                :value="true"
              >
                <template #badge>
                  <v-icon>
                    public
                  </v-icon>
                </template>
                <v-icon
                  class="text-2xl"
                  v-on="tooltip"
                >
                  add
                </v-icon>
              </v-badge>
            </v-list-item-avatar>
          </template>
          {{ t('server.add') }}
        </v-tooltip>

        <v-list-item-title>Instance</v-list-item-title>
      </v-list-item>

      <v-list-item
        push
        class="non-moveable"
        @click="onImport('folder')"
      >
        <v-tooltip
          color="black"
          transition="scroll-x-transition"
          :close-delay="0"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item-avatar
              size="48"
              class="hover:rounded-xl transition-all duration-300 bg-[rgba(80,80,80,0.4)] hover:bg-green-500"
              large
              v-on="tooltip"
            >
              <v-badge
                right
                color="transparent"
                bottom
                overlap
                offset-x="13"
                offset-y="17"
                :value="true"
              >
                <template #badge>
                  <v-icon>
                    folder
                  </v-icon>
                </template>
                <v-icon
                  class="text-2xl"
                  v-on="tooltip"
                >
                  add
                </v-icon>
              </v-badge>
            </v-list-item-avatar>
          </template>
          {{ t('instances.importFolder') }}
        </v-tooltip>

        <v-list-item-title>
          {{ t('instances.importFolder') }}
        </v-list-item-title>
      </v-list-item>
      <v-spacer />
    </v-list>

    <div class="flex flex-grow-1" />

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
import { BaseServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import { useBarBlur } from '../composables/background'
import { useColorTheme } from '../composables/colorTheme'
import { ContextMenuItem } from '../composables/contextMenu'
import { useDialog } from '../composables/dialog'
import { AddInstanceDialogKey } from '../composables/instanceAdd'
import { useSortedInstance } from '../composables/instanceSort'
import { useCurrentUser } from '../composables/user'
import { vContextMenu } from '../directives/contextMenu'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'
import { useService } from '/@/composables'
import { useLocalStorageCacheBool } from '/@/composables/cache'

const sideBarShowCurseforge = useLocalStorageCacheBool('sideBarShowCurseforge', true)
const sideBarShowModrinth = useLocalStorageCacheBool('sideBarShowModrinth', true)
const sideBarShowFtb = useLocalStorageCacheBool('sideBarShowFtb', true)
const { state } = useService(BaseServiceKey)
const { gameProfile } = useCurrentUser()
const { blurSidebar } = useBarBlur()
const router = useRouter()
const expanding = ref(false)
const subRoutes = new Set([
  '/',
  '/base-setting',
  '/mod-setting',
  '/resource-pack-setting',
  '/shader-pack-setting',
])
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)
const { show: showAddServerDialog } = useDialog('add-server-dialog')
const { instances, setToPrevious } = useSortedInstance()

const items = computed(() => {
  const result: ContextMenuItem[] = [
    {
      text: 'Curseforge',
      icon: sideBarShowCurseforge.value ? 'check' : '',
      onClick() {
        sideBarShowCurseforge.value = !sideBarShowCurseforge.value
      },
      children: [],
    },
    {
      text: 'Modrinth',
      icon: sideBarShowModrinth.value ? 'check' : '',
      onClick() {
        sideBarShowModrinth.value = !sideBarShowModrinth.value
      },
      children: [],
    },
    {
      text: 'Feed The Beast',
      icon: sideBarShowFtb.value ? 'check' : '',
      onClick() {
        sideBarShowFtb.value = !sideBarShowFtb.value
      },
      children: [],
    },
  ]
  return result
})

const { t } = useI18n()
const { sideBarColor } = useColorTheme()

expanding.value = subRoutes.has(router.currentRoute.fullPath)

router.afterEach((to) => {
  if (!subRoutes.has(to.fullPath)) {
    expanding.value = false
  } else {
    expanding.value = true
  }
})

const { showOpenDialog } = windowController
const { addExternalInstance } = useService(InstanceServiceKey)

async function onImport(type: 'zip' | 'folder') {
  const fromFolder = type === 'folder'
  const filters = fromFolder
    ? []
    : [{ extensions: ['zip'], name: 'Zip' }]
  const { filePaths } = await showOpenDialog({
    title: t('instances.importFolder'),
    message: t('instances.importFolderDescription'),
    filters,
    properties: fromFolder ? ['openDirectory'] : ['openFile'],
  })
  if (filePaths && filePaths.length > 0) {
    const filePath = filePaths[0]
    if (type === 'folder') {
      addExternalInstance(filePath)
    }
  }
}

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
