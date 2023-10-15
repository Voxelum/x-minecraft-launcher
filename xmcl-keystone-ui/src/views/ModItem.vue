<template>
  <v-list-item
    v-context-menu="getContextMenuItems"
    v-shared-tooltip="[tooltip, hasUpdate ? 'primary' : 'black']"
    :input-value="selected"
    link
    @click="emit('click')"
  >
    <v-list-item-avatar v-if="!selectionMode">
      <v-img :src="icon || item.icon || unknownServer" />
    </v-list-item-avatar>
    <v-list-item-action v-else>
      <v-checkbox
        v-model="isChecked"
        hide-details
        @click.stop
      />
    </v-list-item-action>
    <v-list-item-content>
      <v-badge
        color="red"
        dot
        inline
        :value="hasUpdate"
        :offset-y="5"
      >
        <v-list-item-title class="flex overflow-hidden">
          <span class="max-w-full overflow-hidden overflow-ellipsis">
            {{ title || item.title }}
          </span>
          <template
            v-if="item.installed.length > 0"
          >
            <div class="flex-grow" />
            <v-btn
              x-small
              icon
              @click.stop="onSettingClick"
            >
              <v-icon
                class="v-list-item__subtitle"
                size="15"
              >
                settings
              </v-icon>
            </v-btn>
          </template>
        </v-list-item-title>
      </v-badge>
      <v-list-item-subtitle>{{ description || item.description }}</v-list-item-subtitle>
      <v-list-item-subtitle class="invisible-scroll flex flex-grow-0 gap-2">
        <template v-if="item.installed && (item.installed?.[0]?.tags.length + compatibility.length) > 0">
          <ModLabels
            :compatibility="compatibility"
            :tags="item.installed[0].tags"
          />
        </template>
        <template v-else>
          <div>
            {{ item.author }}
          </div>
          <template v-if="downloadCount || item.downloadCount">
            <v-divider
              v-if="item.author"
              vertical
            />
            <div class="flex flex-grow-0 ">
              <v-icon
                class="material-icons-outlined"
                left
                small
              >
                file_download
              </v-icon>
              {{ getExpectedSize(downloadCount || item.downloadCount || 0, '') }}
            </div>
          </template>
          <template v-if="followerCount || item.followerCount">
            <v-divider vertical />
            <div class="flex flex-grow-0">
              <v-icon
                left
                small
                color="orange"
                class="material-icons-outlined text-gray-300"
              >
                star_rate
              </v-icon>
              {{ followerCount || item.followerCount }}
            </div>
          </template>
          <template v-if="item.modrinth || item.modrinthProjectId">
            <v-divider vertical />
            <div>
              <v-icon small>
                $vuetify.icons.modrinth
              </v-icon>
            </div>
          </template>
          <template v-if="item.curseforge || item.curseforgeProjectId">
            <v-divider vertical />
            <div>
              <v-icon small>
                $vuetify.icons.curseforge
              </v-icon>
            </div>
          </template>
          <template v-if="item.files && item.files.length > 0">
            <v-divider vertical />
            <div>
              <v-icon small>
                storage
              </v-icon>
            </div>
          </template>
        </template>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action
      v-if="!item.installed"
      class="flex flex-grow-0 flex-row self-center"
    >
      <v-avatar
        v-if="item.forge"
        size="30px"
      >
        <v-img
          width="28"
          :src="'image://builtin/forge'"
        />
      </v-avatar>
      <v-avatar
        v-if="item.fabric"
        size="30px"
      >
        <v-img
          width="28"
          :src="'image://builtin/fabric'"
        />
      </v-avatar>
      <v-avatar
        v-if="item.quilt"
        size="30px"
      >
        <v-img
          width="28"
          :src="'image://builtin/quilt'"
        />
      </v-avatar>
      <v-avatar size="30px">
        <v-icon>
          {{ item.modrinth ? '$vuetify.icons.modrinth' : item.curseforge ? '$vuetify.icons.curseforge' : 'inventory_2' }}
        </v-icon>
      </v-avatar>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang="ts" setup>
import unknownServer from '@/assets/unknown_server.png'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useModCompatibility } from '@/composables/modCompatibility'
import { useModItemContextMenuItems } from '@/composables/modContextMenu'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { vContextMenu } from '@/directives/contextMenu'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { Mod } from '@/util/mod'
import { getModrinthProjectKey } from '@/util/modrinth'
import { getExpectedSize } from '@/util/size'
import { swrvGet } from '@/util/swrvGet'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import ModLabels from './ModLabels.vue'
import { useContextMenu } from '@/composables/contextMenu'

const props = defineProps<{
  item: Mod
  selectionMode: boolean
  checked: boolean
  selected: boolean
  hasUpdate?: boolean
}>()

const emit = defineEmits(['click', 'checked'])

const isChecked = computed({
  get() {
    return props.checked
  },
  set(v) {
    emit('checked', v)
  },
})

const config = injection(kSWRVConfig)
const icon = ref(undefined as undefined | string)
const title = ref(undefined as undefined | string)
const description = ref(undefined as undefined | string)
const downloadCount = ref(undefined as undefined | number)
const followerCount = ref(undefined as undefined | number)
const { open } = useContextMenu()

watch(() => props.item, (newMod) => {
  if (newMod) {
    icon.value = undefined
    title.value = undefined
    description.value = undefined
    downloadCount.value = undefined
    followerCount.value = undefined

    if (!newMod.curseforge && !newMod.modrinth) {
      const { curseforgeProjectId, modrinthProjectId } = newMod
      if (modrinthProjectId) {
        swrvGet(getModrinthProjectKey(modrinthProjectId), () => clientModrinthV2.getProject(modrinthProjectId),
          config.cache,
          config.dedupingInterval, { ttl: config.ttl })
          .then((project) => {
            icon.value = project.icon_url
            title.value = project.title
            description.value = project.description
            downloadCount.value = project.downloads
            followerCount.value = project.followers
          })
      } else if (curseforgeProjectId) {
        swrvGet(`/curseforge/${curseforgeProjectId}`, () => clientCurseforgeV1.getMod(curseforgeProjectId),
          config.cache,
          config.dedupingInterval, { ttl: config.ttl })
          .then((project) => {
            icon.value = project.logo?.url
            title.value = project.name
            description.value = project.summary
            downloadCount.value = project.downloadCount
            followerCount.value = project.thumbsUpCount
          })
      }
    }
  }
}, { immediate: true })
const { provideRuntime } = injection(kInstanceModsContext)
const { t } = useI18n()
const tooltip = computed(() => props.hasUpdate ? t('mod.hasUpdate') : props.item.description || props.item.title)
const { isCompatible, compatibility } = useModCompatibility(computed(() => props.item.installed[0]?.dependencies || []), provideRuntime)
const { uninstall, disable, enable } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)
const getContextMenuItems = useModItemContextMenuItems(computed(() => props.item.installed?.[0] || props.item.files?.[0]), () => {
  if (props.item.installed) {
    uninstall({ path: path.value, mods: props.item.installed.map(i => i.resource) })
  }
}, () => {}, () => {
  if (props.item.installed.length > 0) {
    if (props.item.installed[0].enabled) {
      disable({ path: path.value, mods: props.item.installed.map(i => i.resource) })
    } else {
      enable({ path: path.value, mods: props.item.installed.map(i => i.resource) })
    }
  }
})
const onSettingClick = (event: MouseEvent) => {
  const button = event.target as any // Get the button element
  const rect = button.getBoundingClientRect() // Get the position of the button
  const bottomLeftX = rect.left // X-coordinate of the bottom-left corner
  const bottomLeftY = rect.bottom // Y-coordinate of the bottom-left corner

  open(bottomLeftX, bottomLeftY, getContextMenuItems())
}
</script>
