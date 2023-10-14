<template>
  <v-list-item
    v-context-menu="contextMenuItems"
    v-shared-tooltip="[tooltip, hasUpdate ? 'primary' : 'black']"
    :input-value="selected"
    link
    @click="emit('click')"
  >
    <v-list-item-avatar v-if="!selectionMode">
      <v-img
        :src="item.icon || unknownServer"
      />
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
        <v-list-item-title>
          {{ item.title }}
        </v-list-item-title>
      </v-badge>
      <v-list-item-subtitle>{{ item.description }}</v-list-item-subtitle>
      <v-list-item-subtitle class="invisible-scroll flex flex-grow-0 gap-2">
        <template
          v-if="item.installed && (item.installed?.[0]?.tags.length + compatibility.length) > 0"
        >
          <ModLabels
            :compatibility="compatibility"
            :tags="item.installed[0].tags"
          />
        </template>
        <template v-else>
          <div>
            {{ item.author }}
          </div>
          <template
            v-if="item.downloadCount"
          >
            <v-divider
              v-if="item.author"
              vertical
            />
            <div
              class="flex flex-grow-0 "
            >
              <v-icon
                class="material-icons-outlined"
                left
                small
              >
                file_download
              </v-icon>
              {{ getExpectedSize(item.downloadCount, '' ) }}
            </div>
          </template>
          <template
            v-if="item.followerCount"
          >
            <v-divider vertical />
            <div
              class="flex flex-grow-0"
            >
              <v-icon
                left
                small
                color="orange"
                class="material-icons-outlined text-gray-300"
              >
                star_rate
              </v-icon>
              {{ item.followerCount }}
            </div>
          </template>
          <template
            v-if="item.modrinth || item.modrinthProjectId"
          >
            <v-divider
              vertical
            />
            <div>
              <v-icon
                small
              >
                $vuetify.icons.modrinth
              </v-icon>
            </div>
          </template>
          <template
            v-if="item.curseforge || item.curseforgeProjectId"
          >
            <v-divider
              vertical
            />
            <div>
              <v-icon
                small
              >
                $vuetify.icons.curseforge
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
      <v-avatar
        size="30px"
      >
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
import { vContextMenu } from '@/directives/contextMenu'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { Mod } from '@/util/mod'
import { getExpectedSize } from '@/util/size'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import ModLabels from './ModLabels.vue'

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
const { provideRuntime } = injection(kInstanceModsContext)
const { t } = useI18n()
const tooltip = computed(() => props.hasUpdate ? t('mod.hasUpdate') : props.item.description || props.item.title)
const { isCompatible, compatibility } = useModCompatibility(computed(() => props.item.installed[0]?.dependencies || []), provideRuntime)
const { uninstall } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)
const contextMenuItems = useModItemContextMenuItems(computed(() => props.item.installed?.[0] || props.item.files?.[0]), () => {
  if (props.item.installed) {
    uninstall({ path: path.value, mods: props.item.installed.map(i => i.resource) })
  }
}, () => {})
</script>
