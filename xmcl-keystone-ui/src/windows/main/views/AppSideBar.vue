<template>
  <v-navigation-drawer
    :value="true"
    permanent
    width="200"
    :mini-variant="true"
    :color="sideBarColor"
    class="moveable sidebar z-10"
  >
    <v-list
      nav
      dense
      class="px-2 ml-1"
    >
      <v-list-item
        class="px-2 flex-grow-0 flex-1 non-moveable"
        link
        push
        to="/user"
      >
        <v-list-item-avatar
          size="48"
          large
        >
          <PlayerAvatar
            :src="gameProfile.textures.SKIN.url"
            :dimension="48"
          />
        </v-list-item-avatar>

        <v-list-item-title>{{ gameProfile.name }}</v-list-item-title>
      </v-list-item>
    </v-list>

    <v-divider />
    <v-list
      nav
      dense
      class=" px-2 ml-1 overflow-auto flex flex-col justify-start flex-grow-0"
    >
      <div class="mb-1">
        <v-list-group
          v-model="expanding"
          push
          color="currentColor"
          class="non-moveable"
          prepend-icon="home"
          link
          @click.capture="onHomeClick"
        >
          <v-divider />
          <v-tooltip
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-list-item
                link
                push
                to="/mod-setting"
                class="non-moveable"
                v-on="tooltip"
              >
                <v-list-item-icon>
                  <v-icon>
                    extension
                  </v-icon>
                  <!-- <v-icon> extension </v-icon> -->
                </v-list-item-icon>

                <v-list-item-title v-text="'Text'" />
              </v-list-item>
            </template>
            {{ tc('mod.name', 2) }}
          </v-tooltip>
          <v-tooltip
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-list-item
                link
                push
                to="/resource-pack-setting"
                class="non-moveable"
                v-on="tooltip"
              >
                <v-list-item-icon>
                  <v-icon> palette </v-icon>
                </v-list-item-icon>
                <v-list-item-title v-text="'Text'" />
              </v-list-item>
            </template>
            {{ tc('resourcepack.name', 2) }}
          </v-tooltip>

          <v-tooltip
            :close-delay="0"
            right
          >
            <template #activator="{ on: tooltip }">
              <v-list-item
                link
                push
                to="/shader-pack-setting"
                class="non-moveable"
                v-on="tooltip"
              >
                <v-list-item-icon>
                  <v-icon> gradient </v-icon>
                </v-list-item-icon>
                <v-list-item-title v-text="'Text'" />
              </v-list-item>
            </template>
            {{ tc('shaderPack.name', 2) }}
          </v-tooltip>
          <v-divider />
        </v-list-group>
      </div>

      <v-tooltip
        :close-delay="0"
        right
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            push
            link
            to="/instances"
            class="non-moveable"
            v-on="tooltip"
          >
            <v-list-item-icon>
              <v-icon>apps</v-icon>
            </v-list-item-icon>
            <v-list-item-title>Instances</v-list-item-title>
          </v-list-item>
        </template>
        {{ t('instances.choose') }}
      </v-tooltip>

      <v-tooltip
        :close-delay="0"
        right
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            push
            link
            class="non-moveable"
            to="/modpack-setting"
            v-on="tooltip"
          >
            <v-list-item-icon>
              <v-icon>
                inventory
              </v-icon>
            </v-list-item-icon>
            <v-list-item-title>Modpack</v-list-item-title>
          </v-list-item>
        </template>
        {{ tc('modpack.name', 2) }}
      </v-tooltip>

      <v-tooltip
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
                swap_horiz
              </v-icon>
            </v-list-item-icon>
            <v-list-item-title>Multiplayer</v-list-item-title>
          </v-list-item>
        </template>
        {{ t('multiplayer.name') }}
      </v-tooltip>

      <v-list-item
        link
        class="non-moveable"
        @click="show()"
      >
        <v-list-item-icon>
          <v-badge
            right
            overlap
            :value="count !== 0"
          >
            <template #badge>
              <span>{{ count }}</span>
            </template>
            <v-icon>
              assignment
            </v-icon>
          </v-badge>
        </v-list-item-icon>
        <v-list-item-title>Tasks</v-list-item-title>
      </v-list-item>
      <v-divider
        style="display: block !important;"
      />
      <v-list-item
        link
        push
        to="/setting"
        class="non-moveable"
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
    </v-list>
  </v-navigation-drawer>
</template>

<script lang=ts setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import { useColorTheme } from '../composables/colorTheme'
import { useDialog } from '../composables/dialog'
import { useTaskCount } from '../composables/task'
import { useCurrentUser } from '../composables/user'
import { useI18n, useRouter, useService } from '/@/composables'

const { count } = useTaskCount()
const { show } = useDialog('task')
const { state } = useService(BaseServiceKey)
const { gameProfile } = useCurrentUser()
const router = useRouter()
const expanding = ref(false)
const subRoutes = new Set([
  '/',
  '/base-setting',
  '/mod-setting',
  '/resource-pack-setting',
  '/shader-pack-setting',
])

const { t, tc } = useI18n()
const { sideBarColor } = useColorTheme()

const onHomeClick = (event: Event) => {
  event.stopPropagation()
  expanding.value = true
  if (router.currentRoute.fullPath === '/') {
    return
  }
  router.push('/')
}

expanding.value = subRoutes.has(router.currentRoute.fullPath)

router.afterEach((to) => {
  if (!subRoutes.has(to.fullPath)) {
    expanding.value = false
  } else {
    expanding.value = true
  }
})

</script>

<style scoped>
.sidebar {
  min-width: 80px;
  overflow-y: auto;
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
  color: rgb(255, 255, 255);
}
</style>
