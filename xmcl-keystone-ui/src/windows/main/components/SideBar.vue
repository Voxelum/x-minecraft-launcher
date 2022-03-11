<template>
  <v-navigation-drawer
    :value="true"
    permanent
    width="200"
    :mini-variant="true"
    class="moveable sidebar z-10 rounded-r"
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
        <v-list-item-avatar>
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
      <!-- <v-list-item
        push
        link
        to="/"
      >
        <v-list-item-icon>
          <v-icon>home</v-icon>
        </v-list-item-icon>
        <v-list-item-title>Home</v-list-item-title>
      </v-list-item> -->

      <div class="mb-1">
        <v-list-group
          v-model="expanding"
          push
          color="currentColor"
          prepend-icon="home"
          link
          @click.capture="onHomeClick"
        >
          <!-- <v-list-item
            link
            push
            to="/base-setting"
          >
            <v-list-item-icon>
              <v-icon> more_vert </v-icon>
            </v-list-item-icon>
            <v-list-item-title v-text="'Text'" />
          </v-list-item> -->
          <v-list-item
            link
            push
            to="/mod-setting"
          >
            <v-list-item-icon>
              <v-icon> extension </v-icon>
            </v-list-item-icon>
            <v-list-item-title v-text="'Text'" />
          </v-list-item>
          <v-list-item
            link
            push
            to="/resource-pack-setting"
          >
            <v-list-item-icon>
              <v-icon> palette </v-icon>
            </v-list-item-icon>
            <v-list-item-title v-text="'Text'" />
          </v-list-item>
          <v-list-item
            link
            push
            to="/shader-pack-setting"
          >
            <v-list-item-icon>
              <v-icon> gradient </v-icon>
            </v-list-item-icon>
            <v-list-item-title v-text="'Text'" />
          </v-list-item>
        </v-list-group>
      </div>

      <v-list-item
        push
        link
        to="/instances"
      >
        <v-list-item-icon>
          <v-icon>apps</v-icon>
        </v-list-item-icon>
        <v-list-item-title>Instances</v-list-item-title>
      </v-list-item>
      <v-list-item
        push
        link
        to="/modpack-setting"
      >
        <v-list-item-icon>
          <v-icon>
            inventory
          </v-icon>
        </v-list-item-icon>
        <v-list-item-title>Modpack</v-list-item-title>
      </v-list-item>
      <v-list-item
        push
        link
        to="/curseforge/mc-mods"
      >
        <v-list-item-icon>
          <v-icon>
            $vuetify.icons.curseforge
          </v-icon>
        </v-list-item-icon>
        <v-list-item-title>Curseforge</v-list-item-title>
      </v-list-item>
      <v-list-item
        push
        link
        to="/modrinth"
      >
        <v-list-item-icon>
          <v-icon>
            $vuetify.icons.modrinth
          </v-icon>
        </v-list-item-icon>
        <v-list-item-title>Modrinth</v-list-item-title>
      </v-list-item>
      <!-- <v-list-item
        push
        to="/mcwiki"
      >
        <v-list-item-icon style="padding-right: 2px;">
          <v-icon>file</v-icon>
        </v-list-item-icon>
      </v-list-item> -->
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
        @click="showTaskDialog"
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
            :value="updateStatus !== 'none'"
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

<script lang=ts>
import {
  computed,
  defineComponent,
  ref,
  watch,
} from '@vue/composition-api'
import ImageShowTextureHead from './ImageShowTextureHead.vue'
import {
  useCurrentUser, useRouter, useTaskCount,
  useUpdateInfo,
} from '/@/hooks'
import { useDialog } from '/@/windows/main/composables'

export default defineComponent({
  components: { ImageShowTextureHead },
  setup() {
    const { count } = useTaskCount()
    const { show } = useDialog('task')
    const { updateStatus } = useUpdateInfo()
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

    // watch(computed(() => router.currentRoute.fullPath), () => {
    //   expanding.value = subRoutes.has(router.currentRoute.fullPath)
    // })

    router.afterEach((to) => {
      if (!subRoutes.has(to.fullPath)) {
        expanding.value = false
      }
    })

    return {
      expanding,
      updateStatus,
      onHomeClick,
      count,
      showTaskDialog: show,
      gameProfile,
    }
  },
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
</style>
