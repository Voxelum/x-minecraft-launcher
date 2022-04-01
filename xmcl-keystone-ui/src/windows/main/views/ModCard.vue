<template>
  <v-card
    v-selectable-card
    v-long-press="emitSelect"
    v-context-menu="contextMenuItems"
    outlined
    :draggable="!source.enabled"
    :dark="source.subsequence"
    :class="{
      incompatible: compatible === false,
      maybe: compatible === 'maybe',
      subsequence: source.subsequence === true,
      dragged: source.dragged
    }"
    class="draggable-card mod-card rounded-lg transition-all duration-200"
    style="margin-top: 10px; padding: 0 10px; content-visibility: auto;"
    @dragstart="onDragStart"
    @dragend="$emit('dragend', $event)"
    @mouseenter="$emit('mouseenter', $event)"
    @click="$emit('click', $event)"
  >
    <v-tooltip top>
      <template #activator="{ on }">
        <transition-group
          class="layout justify-center align-center fill-height select-none"
          name="transition-list"
          tag="div"
        >
          <v-flex
            :key="0"
            class="flex-grow-0 "
            :style="{ display: selection ? 'flex' : 'none !important' }"
          >
            <v-checkbox
              v-model="source.selected"
              @input="$emit('select')"
            />
          </v-flex>
          <v-flex
            v-if="!source.subsequence"
            :key="1"
            class="avatar"
          >
            <img
              ref="iconImage"
              v-fallback-img="unknownPack"
              :src="source.icon"
              contain
            >
          </v-flex>
          <div
            :key="2"
            class="flex-grow py-2"
            v-on="on"
          >
            <h3
              v-if="!source.subsequence"
              class="text-lg font-bold"
            >
              {{ source.name }}
            </h3>
            <div class="flex gap-1 flex-wrap">
              <v-chip
                small
                outlined
                label
                color="amber"
                style="margin-left: 1px;"
                @mousedown.stop
              >
                {{ source.version }}
              </v-chip>
              <v-chip
                small
                outlined
                color="orange en-1"
                label
                style="margin-left: 1px;"
                @mousedown.stop
              >
                {{ source.id }}
              </v-chip>
              <v-chip
                small
                outlined
                label
                color="lime"
                style="margin-left: 1px;"
                @mousedown.stop
              >
                {{ source.type }}
              </v-chip>

              <v-chip
                v-for="(tag, index) in source.tags"
                :key="`${tag}-${index}`"
                small
                outlined
                label
                :color="getColor(tag)"
                style="margin-left: 1px;"
                close
                @mousedown.stop
                @click:close="onDeleteTag(tag)"
              >
                <div
                  contenteditable
                  class="max-w-50 overflow-auto"
                  @input.stop="onEditTag($event, index)"
                  @blur="$emit('tags', [...source.tags])"
                >
                  {{ tag }}
                </div>
              </v-chip>
            </div>

            <v-card-text class=" p-1">
              {{ source.description }}
            </v-card-text>
          </div>
          <v-flex
            :key="3"
            style="flex-grow: 0"
            @click.stop
            @mousedown.stop
          >
            <v-switch v-model="enabled" />
          </v-flex>
        </transition-group>
      </template>
      {{ compatibleText }}
      <v-divider />
    </v-tooltip>
  </v-card>
</template>

<script lang=ts setup>
import { Ref } from '@vue/composition-api'
import { BaseServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import unknownPack from '/@/assets/unknown_pack.png'
import { useI18n, useRouter, useService, useTags } from '/@/composables'
import { getColor } from '/@/util/color'
import { ModItem } from '../composables/mod'
import { useInstanceVersionBase } from '../composables/instance'
import { useModCompatible } from '../composables/compatible'
import { ContextMenuItem } from '../composables/contextMenu'
import { useCurseforgeRoute, useMcWikiRoute } from '../composables/curseforgeRoute'
import { vContextMenu } from '../directives/contextMenu'

const props = defineProps<{ source: ModItem; selection: boolean }>()
const emit = defineEmits(['tags', 'enable', 'dragstart', 'select', 'delete'])

const { minecraft, forge, fabricLoader } = useInstanceVersionBase()
const { state: instanceState } = useService(InstanceServiceKey)
const { compatible } = useModCompatible(computed(() => props.source.resource), computed(() => instanceState.instance.runtime))
const { openInBrowser, showItemInDirectory } = useService(BaseServiceKey)
const { push } = useRouter()
const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute()
const { searchProjectAndRoute: searchMcWiki } = useMcWikiRoute()
const { $t } = useI18n()
const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.source.tags, set(v) { emit('tags', v) } }))

const onDeleteTag = removeTag
const iconImage: Ref<HTMLImageElement | null> = ref(null)
const enabled = computed({
  get() { return props.source.enabled },
  set(v: boolean) { emit('enable', { item: props.source, enabled: v }) },
})

const compatibleText = computed(() => {
  const deps = props.source.dependencies
  let acceptVersionText = $t('mod.acceptVersion', { version: deps.minecraft }) + ', ' + $t('mod.currentVersion', { current: minecraft.value }) + '.'
  if (deps.forge) {
    acceptVersionText += ` Forge ${deps.forge}` + (forge.value ? `, ${$t('mod.currentVersion', { current: forge.value })}.` : '')
  }
  if (deps.fabricLoader) {
    acceptVersionText += `, FabricLoader ${deps.fabricLoader}` + (fabricLoader.value ? `, ${$t('mod.currentVersion', { current: fabricLoader.value })}.` : '')
  }
  const compatibleText = compatible.value === 'maybe'
    ? $t('mod.maybeCompatible')
    : compatible.value
      ? $t('mod.compatible')
      : $t('mod.incompatible')
  return compatibleText + acceptVersionText
})

function onDragStart(e: DragEvent) {
  if (props.source.enabled) {
    return
  }
  if (iconImage.value) {
    e.dataTransfer!.setDragImage(iconImage.value!, 0, 0)
  } else {
    const img = document.createElement('img')
    img.src = props.source.icon
    img.style.maxHeight = '126px'
    img.style.maxWidth = '126px'
    img.style.objectFit = 'contain'

    e.dataTransfer!.setDragImage(img, 0, 0)
  }
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('id', props.source.url)
  emit('dragstart', e)
}
function onEditTag(event: Event, index: number) {
  if (event.target instanceof HTMLDivElement) {
    editTag(event.target.innerText, index)
  }
}
function emitSelect() {
  emit('select')
}

const contextMenuItems = computed(() => {
  const items: ContextMenuItem[] = [{
    text: $t('mod.showFile', { file: props.source.path }),
    children: [],
    onClick: () => {
      showItemInDirectory(props.source.path)
    },
    icon: 'folder',
  }, {
    text: $t('tag.create'),
    children: [],
    onClick: () => {
      createTag()
    },
    icon: 'add',
  }]
  if (!props.source.selected) {
    items.push({
      text: $t('delete.name', { name: props.source.name }),
      children: [],
      onClick() {
        emit('delete')
      },
      icon: 'delete',
      color: 'red',
    })
  }
  if (props.source.url) {
    const url = props.source.url
    items.push({
      text: $t('mod.openLink', { url }),
      children: [],
      onClick: () => {
        openInBrowser(url)
      },
      icon: 'link',
    })
  }
  if (props.source.curseforge) {
    const curseforge = props.source.curseforge
    items.push({
      text: $t('mod.showInCurseforge', { name: props.source.name }),
      children: [],
      onClick: () => {
        goProjectAndRoute(curseforge.projectId, 'mc-mods')
      },
      icon: '$vuetify.icons.curseforge',
    })
  } else {
    items.push({
      text: $t('mod.searchOnCurseforge', { name: props.source.name }),
      children: [],
      onClick: () => {
        searchProjectAndRoute(props.source.name, 'mc-mods')
      },
      icon: 'search',
    })
  }
  if (props.source.modrinth) {
    const modrinth = props.source.modrinth
    items.push({
      text: $t('mod.showInModrinth', { name: props.source.name }),
      children: [],
      onClick: () => {
        push(`/modrinth/${modrinth.projectId}`)
      },
      icon: '$vuetify.icons.modrinth',
    })
  } else {
    items.push({
      text: $t('mod.searchOnModrinth', { name: props.source.name }),
      children: [],
      onClick: () => {
        push(`/modrinth?query=${props.source.name}`)
      },
      icon: 'search',
    })
  }
  items.push({
    text: $t('mod.searchOnMcWiki', { name: props.source.name }),
    children: [],
    onClick: () => {
      searchMcWiki(props.source.name)
    },
    icon: 'search',
  })
  return items
})
</script>

<style scoped>
.draggable-card:hover {
  background-color: #388e3c;
}

.unknown:hover {
  background-color: #bb724b;
}
.maybe:hover {
  background-color: #679793;
}
.title {
  max-width: 100%;
  white-space: nowrap;
}
.subsequence {
  margin-left: 40px;
}
.incompatible.draggable-card:hover {
  background-color: #e65100;
}
.subsequence.draggable-card {
  background-color: #616161;
  border-color: #616161;
}
.subsequence.draggable-card:hover {
  background-color: #388e3c;
}
.subsequence.incompatible.draggable-card:hover {
  background-color: #e65100 !important;
}
.mod-card .avatar {
  min-height: 50px;
  max-height: 50px;
  max-width: 50px;
  min-width: 50px;
  margin: 0 10px 0 0;
}
</style>
