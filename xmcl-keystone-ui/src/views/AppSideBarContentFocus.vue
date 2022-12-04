<template>
  <div class="h-full overflow-auto">
    <v-divider />
    <v-list
      nav
      dense
      class="px-2 ml-1 overflow-auto flex flex-col justify-start flex-grow-0"
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
            color="black"
            transition="scroll-x-transition"
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
            {{ t('mod.name', 2) }}
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
            {{ t('resourcepack.name', 2) }}
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
            {{ t('shaderPack.name', 2) }}
          </v-tooltip>
          <v-divider />
        </v-list-group>
      </div>

      <v-tooltip
        color="black"
        transition="scroll-x-transition"
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

      <v-spacer />
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import { useLocalStorageCacheBool } from '@/composables/cache'

const router = useRouter()
const expanding = ref(false)
const subRoutes = new Set([
  '/',
  '/base-setting',
  '/mod-setting',
  '/resource-pack-setting',
  '/shader-pack-setting',
])
expanding.value = subRoutes.has(router.currentRoute.fullPath)

const sideBarShowCurseforge = useLocalStorageCacheBool('sideBarShowCurseforge', true)
const sideBarShowModrinth = useLocalStorageCacheBool('sideBarShowModrinth', true)
const sideBarShowFtb = useLocalStorageCacheBool('sideBarShowFtb', true)

router.afterEach((to) => {
  if (!subRoutes.has(to.fullPath)) {
    expanding.value = false
  } else {
    expanding.value = true
  }
})
const onHomeClick = (event: Event) => {
  event.stopPropagation()
  expanding.value = true
  if (router.currentRoute.fullPath === '/') {
    return
  }
  router.push('/')
}
const { t } = useI18n()
</script>
