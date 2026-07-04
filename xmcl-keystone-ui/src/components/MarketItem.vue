<template>
  <v-list-item
    v-context-menu="getContextMenuItems"
    v-shared-tooltip="() => ({ text: tooltip, color: hasUpdate ? 'primary' : 'black' })"
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
    :active="selected"
    :lines="dense ? 'one' : 'two'"
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
    <template #prepend>
      <v-avatar :size="dense ? 30 : 40">
        <img
          ref="iconImage"
          v-fallback-img="BuiltinImages.unknownServer"
          class="market-item__icon"
          :class="{ 'opacity-20': item.installed.length === 0 && hover && !item.unsupported }"
          :src="icon || item.icon || BuiltinImages.unknownServer"
        >
        <v-btn
          v-if="install && item.installed.length === 0 && !item.unsupported"
          data-testid="market-item-install"
          class="absolute"
          icon
          variant="text"
          size="small"
          :loading="installing"
          :disabled="installing"
          @click.stop="onInstall()"
        >
          <v-icon
            class="material-icons-outlined"
            :class="{ 'opacity-0': !hover }"
          >
            file_download
          </v-icon>
        </v-btn>
      </v-avatar>
      <div
        v-if="indent"
        class="indicator"
        :style="{ height: `${height}px`, background: indentColor || 'rgb(250 204 21 / 1)' }"
      />
    </template>

    <template #title>
      <div class="flex items-center overflow-hidden gap-1">
        <span class="flex-1 max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap">
          {{ (isEnabled ? item.localizedTitle : '') || title || item.title }}
        </span>
        <slot name="title-chip" />
        <v-badge
          v-if="hasUpdate"
          color="red"
          dot
          inline
        />
        <template v-if="item.installed.length > 0 && getContextMenuItems">
          <v-icon
            v-if="hasDuplicate"
            v-shared-tooltip="props.item.installed.map(v => basename(v.path)).join(', ')"
            size="15"
            color="red"
          >
            warning
          </v-icon>
          <v-btn
            icon
            variant="text"
            size="x-small"
            density="comfortable"
            @click.stop="onSettingClick"
          >
            <v-icon size="15">
              settings
            </v-icon>
          </v-btn>
        </template>
        <template v-else-if="dense">
          <v-icon size="x-small">
            {{ getTrailingIcon() }}
          </v-icon>
        </template>
      </div>
    </template>

    <template v-if="!dense" #subtitle>
      <div class="market-item__description">
        <template v-if="typeof descriptionTextOrObject === 'object' || descriptionTextOrObject?.includes('§')">
          <TextComponent :source="descriptionTextOrObject" />
        </template>
        <template v-else>
          {{ descriptionTextOrObject }}
        </template>
      </div>
      <div class="invisible-scroll flex gap-2 mt-1 market-item__tags">
        <slot
          v-if="slots.labels"
          name="labels"
        />
        <template v-else>
          <template v-for="(tag, i) of tags" :key="i">
            <v-divider
              v-if="i > 0"
              vertical
            />
            <div class="flex items-center flex-grow-0">
              <v-icon
                v-if="tag.icon"
                class="material-icons-outlined"
                :start="!!tag.text"
                :color="tag.color"
                size="small"
              >
                {{ tag.icon }}
              </v-icon>
              <span class="pt-[2px]">
                {{ tag.text }}
              </span>
            </div>
          </template>
        </template>
      </div>
    </template>
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
import { Ref } from 'vue'
import { Resource } from '@xmcl/resource'
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
  droppable?: boolean
  indent?: boolean
  indentColor?: string
  install?: (p: ProjectEntry) => Promise<void>
  getContextMenuItems?: () => ContextMenuItem[]
}>()
const slots = useSlots()
const emit = defineEmits(['click', 'checked', 'drop', 'drop-files'])

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
  if (props.draggable || (props.droppable && isFileDrag(e))) {
    dragover.value += 1
  }
}
const onDragLeave = () => {
  if (props.draggable || props.droppable) {
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
  const files = e.dataTransfer?.files
  if (props.droppable && files && files.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    const paths = Array.from(files).map((f) => (f as any).path as string).filter(Boolean)
    if (paths.length > 0) {
      emit('drop-files', paths)
    }
    return
  }
  emit('drop', e.dataTransfer?.getData('id'))
}
function onDragOver(e: DragEvent) {
  if (props.draggable || (props.droppable && isFileDrag(e))) {
    e.preventDefault()
  }
}
function isFileDrag(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
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
    return 'xmcl:modrinth'
  }
  if (props.item.curseforge) {
    return 'xmcl:curseforge'
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
      icon: 'xmcl:modrinth',
    })
  }
  if (props.item.curseforge || props.item.curseforgeProjectId) {
    tags.push({
      icon: 'xmcl:curseforge',
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
  if (installing.value) return
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
  position: absolute;
  left: 0;
}
.market-item__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.market-item__description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  opacity: 0.7;
}
.market-item__tags {
  font-size: 0.75rem;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  flex-wrap: nowrap;
}
</style>
