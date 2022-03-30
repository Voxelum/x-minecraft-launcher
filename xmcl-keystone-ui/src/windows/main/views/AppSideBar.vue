<template>
  <v-navigation-drawer
    :value="true"
    permanent
    width="200"
    :mini-variant="true"
    class="moveable sidebar z-10"
  >
    <v-list
      nav
      dense
      class="non-moveable px-2 ml-1"
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
          <ImageShowTextureHead
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
      class="non-moveable px-2 ml-1"
    >
      <div class="mb-1">
        <v-list-group
          v-model="expanding"
          push
          color="currentColor"
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
            {{ $tc('mod.name', 2) }}
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
                v-on="tooltip"
              >
                <v-list-item-icon>
                  <v-icon> palette </v-icon>
                </v-list-item-icon>
                <v-list-item-title v-text="'Text'" />
              </v-list-item>
            </template>
            {{ $tc('resourcepack.name', 2) }}
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
                v-on="tooltip"
              >
                <v-list-item-icon>
                  <v-icon> gradient </v-icon>
                </v-list-item-icon>
                <v-list-item-title v-text="'Text'" />
              </v-list-item>
            </template>
            {{ $tc('shaderpack.name', 2) }}
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
            v-on="tooltip"
          >
            <v-list-item-icon>
              <v-icon>apps</v-icon>
            </v-list-item-icon>
            <v-list-item-title>Instances</v-list-item-title>
          </v-list-item>
        </template>
        {{ $t('profile.profiles') }}
      </v-tooltip>

      <v-tooltip
        :close-delay="0"
        right
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            push
            link
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
        {{ $tc('profile.modpack.name', 2) }}
      </v-tooltip>

      <v-tooltip
        :close-delay="0"
        right
      >
        <template #activator="{ on: tooltip }">
          <v-list-item
            push
            link
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
      class="non-moveable px-2 ml-1"
      style=""
    >
      <v-list-item
        link
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
import ImageShowTextureHead from '../components/ImageShowTextureHead.vue'
import { useDialog } from '../composables/dialog'
import { useTaskCount } from '../composables/task'
import { useCurrentUser } from '../composables/user'
import { TaskDialogKey } from './AppTaskDialog.vue'
import { useRouter, useService } from '/@/composables'

const { count } = useTaskCount()
const { show } = useDialog(TaskDialogKey)
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
  }
})

</script>

<style scoped>
.sidebar {
  min-width: 80px;
}

</style>
<style>

.v-navigation-drawer__content {
  @apply flex flex-col flex-grow-0 h-full;
}

.sidebar .v-list .v-list-item--active, .v-list .v-list-item--active .v-icon {
  color: #4caf50 !important;
}

.sidebar .v-list-item--link:before {
  color: rgb(255, 255, 255);
}
</style>
