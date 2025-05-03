<template>
  <v-list-item
    v-context-menu="getContextMenuItems"
    v-shared-tooltip="_ => ({ text: tooltip, color: hasUpdate ? 'primary' : 'black' })"
    :style="{
      minHeight: height ? height + 'px' : undefined,
      maxHeight: height ? height + 'px' : undefined,
    }"
    style="pointer-events: initial;"
    :draggable="draggable"
    :class="{
      'v-list-item--disabled': disabled || item.disabled || item.unsupported,
      'dragged-over': dragover > 0,
      dense,
    }"
    :input-value="selected"
    link
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @drop="onDrop"
    @click="emit('click', $event)"
  >
    <v-list-item-avatar :size="dense ? 30 : 40">
      <img
        ref="iconImage"
        v-fallback-img="BuiltinImages.unknownServer"
        :class="{ 'opacity-20': item.installed.length === 0 && hover && !item.unsupported }"
        :src="icon || item.icon || BuiltinImages.unknownServer"
      >
      <v-btn
        v-if="install && item.installed.length === 0 && !item.unsupported"
        class="absolute"
        large
        icon
        :loading="installing"
        @click.stop="onInstall()"
      >
        <v-icon
          class="material-icons-outlined"
          :class="{ 'opacity-0': !hover }"
        >
          file_download
        </v-icon>
      </v-btn>
    </v-list-item-avatar>
    <div
      v-if="indent"
      class="indicator"
      :style="{ height: `${height}px`, background: indentColor || 'rgb(250 204 21 / 1)' }"
    />
    <v-list-item-content
      :class="{
        indented: indent,
        dense,
      }"
    >
      <v-badge
        class="w-full"
        color="red"
        dot
        inline
        :value="hasUpdate"
        :offset-y="5"
      >
        <v-list-item-title class="flex overflow-hidden">
          <span class="max-w-full overflow-hidden overflow-ellipsis">
            {{ (isEnabled ? item.localizedTitle : '') || title || item.title }}
          </span>
          <template v-if="item.installed.length > 0 && getContextMenuItems">
            <div class="flex-grow" />
            <v-icon
              v-if="hasDuplicate"
              v-shared-tooltip="props.item.installed.map(v => basename(v.path)).join(', ')"
              size="15"
              color="red"
            >
              warning
            </v-icon>
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
          <template v-else-if="dense">
            <div class="flex-grow" />
            <v-icon small>
              {{ getTrailingIcon() }}
            </v-icon>
          </template>
        </v-list-item-title>
      </v-badge>
      <v-list-item-subtitle v-if="!dense">
        <template v-if="typeof descriptionTextOrObject === 'object' || descriptionTextOrObject?.includes('§')">
          <TextComponent :source="descriptionTextOrObject" />
        </template>
        <template v-else>
          {{ descriptionTextOrObject }}
        </template>
      </v-list-item-subtitle>
      <v-list-item-subtitle
        v-if="!dense"
        class="invisible-scroll flex flex-grow-0 gap-2"
      >
        <slot
          v-if="slots.labels"
          name="labels"
        />
        <template v-else>
          <template v-for="(tag, i) of tags">
            <v-divider
              v-if="i > 0"
              :key="i + 'divider'"
              vertical
            />
            <div
              :key="i"
              class="flex flex-grow-0"
            >
              <v-icon
                v-if="tag.icon"
                class="material-icons-outlined"
                :left="!!tag.text"
                :color="tag.color"
                small
              >
                {{ tag.icon }}
              </v-icon>
              <span class="pt-[2px]">
                {{ tag.text }}
              </span>
            </div>
          </template>
        </template>
      </v-list-item-subtitle>
    </v-list-item-content>
  </v-list-item>
</template>

<script lang="ts" setup>
import { ContextMenuItem, useContextMenu } from '@/composables/contextMenu'
import { getCurseforgeProjectModel } from '@/composables/curseforge'
import { getModrinthProjectModel } from '@/composables/modrinthProject'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { BuiltinImages } from '@/constant'
import { vContextMenu } from '@/directives/contextMenu'
import { vFallbackImg } from '@/directives/fallbackImage'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { getExpectedSize } from '@/util/size'
import { getSWRV } from '@/util/swrvGet'
import { Resource } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import TextComponent from './TextComponent'
import { kLocalizedContent, useLocalizedContentControl } from '@/composables/localizedContent'

const props = defineProps<{
  item: ProjectEntry<ProjectFile>
  selectionMode: boolean
  alt?: boolean
  checked: boolean
  selected: boolean
  noDuplicate?: boolean
  dense?: boolean
  hasUpdate?: boolean
  disabled?: boolean
  height?: number
  draggable?: boolean
  indent?: boolean
  indentColor?: string
  install?: (p: ProjectEntry) => Promise<void>
  getContextMenuItems?: () => ContextMenuItem[]
}>()
const slots = useSlots()
const emit = defineEmits(['click', 'checked', 'drop'])

const hover = ref(false)
const config = injection(kSWRVConfig)
const icon = ref(undefined as undefined | string)
const title = ref(undefined as undefined | string)
const description = ref(undefined as undefined | string)
const downloadCount = ref(undefined as undefined | number)
const followerCount = ref(undefined as undefined | number)
const { open } = useContextMenu()

const descriptionTextOrObject = computed(() => props.item.localizedDescription || description.value || props.item.description || props.item.descriptionTextComponent || '')
const hasDuplicate = computed(() => props.noDuplicate && props.item.installed.length > 1)

const { isEnabled } = inject(kLocalizedContent, useLocalizedContentControl())

const dragover = ref(0)
const onDragEnter = (e: DragEvent) => {
  if (props.draggable) {
    dragover.value += 1
  }
}
const onDragLeave = () => {
  if (props.draggable) {
    dragover.value += -1
  }
}

const iconImage: Ref<any> = ref(null)
function onDragStart(e: DragEvent) {
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer?.setData('id', props.item.id)
  e.dataTransfer!.setDragImage(iconImage.value, 0, 0)
}
function onDragEnd(e: DragEvent) {
}
function onDrop(e: DragEvent) {
  dragover.value = 0
  emit('drop', e.dataTransfer?.getData('id'))
}
function onDragOver(e: DragEvent) {
  if (props.draggable) {
    e.preventDefault()
  }
}

watch(() => props.item, (newVal, old) => {
  if (newVal && newVal.id !== old?.id) {
    icon.value = undefined
    title.value = undefined
    description.value = undefined
    downloadCount.value = undefined
    followerCount.value = undefined

    if (!newVal.curseforge && !newVal.modrinth) {
      const { curseforgeProjectId, modrinthProjectId } = newVal
      if (modrinthProjectId) {
        getSWRV(getModrinthProjectModel(ref(modrinthProjectId)), config).then((project) => {
          if (project) {
            icon.value = project.icon_url
            title.value = project.title
            description.value = project.description
            downloadCount.value = project.downloads
            followerCount.value = project.followers
          }
        })
      } else if (curseforgeProjectId) {
        getSWRV(getCurseforgeProjectModel(ref(curseforgeProjectId)), config).then((project) => {
          if (project) {
            icon.value = project.logo?.url
            title.value = project.name
            description.value = project.summary
            downloadCount.value = project.downloadCount
            followerCount.value = project.thumbsUpCount
          }
        })
      }
    }
  }
}, { immediate: true })
const { t } = useI18n()

const tooltip = computed(() => props.hasUpdate ? t('mod.hasUpdate') : (typeof descriptionTextOrObject.value === 'string' ? descriptionTextOrObject.value.trim() : descriptionTextOrObject.value?.text) || props.item.title.trim())
const onSettingClick = (event: MouseEvent) => {
  const button = event.target as any // Get the button element
  const rect = button.getBoundingClientRect() // Get the position of the button
  const bottomLeftX = rect.left // X-coordinate of the bottom-left corner
  const bottomLeftY = rect.bottom // Y-coordinate of the bottom-left corner

  if (props.getContextMenuItems) {
    open(bottomLeftX, bottomLeftY, props.getContextMenuItems())
  }
}

function getTrailingIcon() {
  if (props.item.modrinth) {
    return '$vuetify.icons.modrinth'
  }
  if (props.item.curseforge) {
    return '$vuetify.icons.curseforge'
  }
}

const tags = computed(() => {
  const tags: { icon?: string; text?: string; color?: string }[] = []

  if (props.item.author) {
    tags.push({
      icon: 'person',
      text: props.item.author,
    })
  }
  if (downloadCount.value || props.item.downloadCount) {
    tags.push({
      icon: 'file_download',
      text: getExpectedSize(downloadCount.value || props.item.downloadCount || 0, ''),
    })
  }
  if (followerCount.value || props.item.followerCount) {
    tags.push({
      icon: 'star_rate',
      color: 'orange',
      text: (followerCount.value || props.item.followerCount || 0).toString(),
    })
  }
  if (props.item.modrinth || props.item.modrinthProjectId) {
    tags.push({
      icon: '$vuetify.icons.modrinth',
    })
  }
  if (props.item.curseforge || props.item.curseforgeProjectId) {
    tags.push({
      icon: '$vuetify.icons.curseforge',
    })
  }
  if (props.item.files && props.item.files.length > 0 && props.item.files[0]) {
    if ('resource' in props.item.files[0]) {
      const res = props.item.files[0].resource as Resource
      tags.push({
        icon: 'storage',
        text: getExpectedSize(res.size),
      })
    }
  }

  return tags
})

const installing = ref(false)
const onInstall = async () => {
  try {
    installing.value = true
    await props.install?.(props.item)
  } finally {
    // Delay for the local file to be updated
    setTimeout(() => {
      installing.value = false
    }, 1000)
  }
}

</script>

<style scoped>
.dragged-over {
  @apply border border-dashed border-transparent border-yellow-400;
}
.indicator {
  content: '';
  min-width: 2px;
  margin-right: 1rem;
}
</style>
