<template>
  <v-card
    class="flex flex-col"
    v-shared-tooltip="_ => name"
    :outlined="isSelected"
    :color="isSelected ? 'primary' : ''"
    v-context-menu.force="getContextMenuItems"
    @click="emit('click', $event)"
  >
    <v-list-item
      :color="isSelected ? 'primary' : ''"
      outlined
    >
      <v-list-item-avatar size="96">
        <v-img
          :src="image"
        />
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title>
          <span class="text-center text-xl capitalize">{{ name }}</span>
        </v-list-item-title>
        <v-list-item-subtitle
          v-if="description"
          >
          <TextComponent
            :source="typeof instance.description === 'object' ? instance.description : { text: instance.description }"
          />
        </v-list-item-subtitle>
        <v-list-item-subtitle class="flex gap-2 flex-wrap">
          <template
            v-for="version of versions"
          >
            <div
              :key="version.text"
              class="flex flex-grow-0 items-center gap-1 px-1 text-sm"
            >
              <v-img
                width="24"
                height="24"
                class="rounded"
                :src="version.icon"
              />
              {{ version.text }}
            </div>
            <v-divider
              v-if="version !== versions[versions.length - 1]"
              :key="version.text + 'divider'"
              class="h-full"
              vertical
            />
          </template>
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-divider>
    </v-divider>
    <v-card-actions class="flex w-full items-center">
      <v-chip
        outlined
        label
        :input-value="false"
      >
        <v-icon left>
          update
        </v-icon>
        {{ getDateString(instance.lastAccessDate, { dateStyle: 'long' }) }}
      </v-chip>
<!--
      <div
        class="flex flex-col items-center justify-center"
      >
        <div
          v-if="instance.server"
          class="text-sm dark:text-gray-300"
        >
          {{ instance.server.host }}:{{ instance.server.port }}
        </div>
      </div>
      <div
        v-if="instance.server"
        class="absolute top-2 flex w-full flex-wrap justify-center gap-2"
      >
        <v-chip
          small
          label
          outlined
          :input-value="false"
          @click.stop
        >
          <TextComponent :source="status.version.name" />
        </v-chip>
      </div>
      <div
        v-if="instance.server"
        class="absolute bottom-2 flex w-full flex-wrap justify-around gap-2"
      >
        <v-chip
          small
          outlined
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon
              :style="{ color: status.ping < 0 ? 'grey' : status.ping < 100 ? 'green' : status.ping < 300 ? 'orange' : 'error' }"
            >
              signal_cellular_alt
            </v-icon>
          </v-avatar>
          {{ status.ping }} ms
        </v-chip>
        <v-chip
          small
          outlined
          label
          :input-value="false"
          @click.stop
        >
          <v-avatar left>
            <v-icon>people</v-icon>
          </v-avatar>
          {{ status.players.online }} / {{ status.players.max }}
        </v-chip>
      </div> -->

      <div class="flex-grow" />
      <v-btn
        icon
        @click.stop="onSettingClick"
      >
        <v-icon>more_vert</v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang=ts setup>
import TextComponent from '@/components/TextComponent'
import { useContextMenu } from '@/composables/contextMenu'
import { useDateString } from '@/composables/date'
import { kInstance } from '@/composables/instance'
import { useInstanceContextMenuItems } from '@/composables/instanceContextMenu'
import { useVersionsWithIcon } from '@/composables/versionLocal'
import { BuiltinImages } from '@/constant'
import { getBanner } from '@/util/banner'
import { injection } from '@/util/inject'
import { Instance } from '@xmcl/runtime-api'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { vContextMenu } from '../directives/contextMenu'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{ instance: Instance }>()
const { path } = injection(kInstance)
const isSelected = computed(() => path.value === props.instance.path)
const { status } = useInstanceServerStatus(computed(() => props.instance))
const { getDateString } = useDateString()

const name = computed(() => props.instance.name || `Minecraft ${props.instance.runtime.minecraft}` )
const versions = useVersionsWithIcon(computed(() => props.instance.runtime))
const emit = defineEmits(['delete', 'click'])

const image = computed(() => {
  if (status.value.favicon && status.value.favicon !== BuiltinImages.unknownServer) {
    return status.value.favicon
  }
  if (props.instance.icon) {
    return props.instance.icon
  }
  const banner = getBanner(props.instance.runtime.minecraft)
  if (banner) {
    return banner
  }
  return BuiltinImages.unknownServer
})
const description = computed(() => props.instance.description)
const { open } = useContextMenu()
const getContextMenuItems = useInstanceContextMenuItems(computed(() => props.instance))
const onSettingClick = (event: MouseEvent) => {
  const button = event.target as any // Get the button element
  const rect = button.getBoundingClientRect() // Get the position of the button
  const bottomLeftX = rect.left // X-coordinate of the bottom-left corner
  const bottomLeftY = rect.bottom // Y-coordinate of the bottom-left corner

  const items = getContextMenuItems()
  if (items) {
    open(bottomLeftX, bottomLeftY, items)
  }
}

</script>

<style>
</style>
