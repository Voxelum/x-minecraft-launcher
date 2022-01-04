<template>
  <v-card
    v-selectable-card
    v-long-press="emitSelect"
    hover
    :draggable="!source.enabled"
    :dark="!source.subsequence"
    :class="{
      incompatible: compatible === false,
      maybe: compatible === 'maybe',
      subsequence: source.subsequence === true,
      dragged: source.dragged
    }"
    class="white--text draggable-card mod-card"
    style="margin-top: 10px; padding: 0 10px; transition-duration: 0.2s; content-visibility: auto;"
    @dragstart="onDragStart"
    @dragend="$emit('dragend', $event)"
    @mouseenter="$emit('mouseenter', $event)"
    @contextmenu="onContextMenu"
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
            v-if="selection"
            :key="0"
            class="flex-grow-0"
          >
            <v-checkbox
              :value="source.selected"
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
            <v-chip
              small
              outline
              label
              color="amber"
              style="margin-left: 1px;"
              @mousedown.stop
            >
              {{ source.version }}
            </v-chip>
            <v-chip
              small
              outline
              color="orange darken-1"
              label
              style="margin-left: 1px;"
              @mousedown.stop
            >
              {{ source.id }}
            </v-chip>
            <v-chip
              small
              outline
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
              outline
              label
              :color="getColor(tag)"
              style="margin-left: 1px;"
              close
              @mousedown.stop
              @input="onDeleteTag(tag)"
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
            <div style="color: #bdbdbd; ">
              {{ source.description }}
            </div>
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

<script lang=ts>
import { computed, defineComponent, ref, Ref } from '@vue/composition-api'
import { ModItem } from './useInstanceMod'
import unknownPack from '/@/assets/unknown_pack.png'
import { useCompatible, useI18n, useInstanceVersionBase, useService, useTags } from '/@/hooks'
import { getColor } from '/@/util/color'
import { required } from '/@/util/props'
import { ContextMenuItem, useContextMenu, useCurseforgeRoute, useMcWikiRoute } from '/@/windows/main/composables'
import { BaseServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'

export default defineComponent({
  props: {
    source: required<ModItem>(Object),
    selection: required<boolean>(Boolean),
  },
  emits: ['tags'],
  setup(props, context) {
    const { minecraft, forge, fabricLoader } = useInstanceVersionBase()
    const { state: instanceState } = useService(InstanceServiceKey)
    const { compatible } = useCompatible(computed(() => props.source.resource), computed(() => instanceState.instance.runtime))
    const { open } = useContextMenu()
    const { openInBrowser, showItemInDirectory } = useService(BaseServiceKey)
    const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute()
    const { searchProjectAndRoute: searchMcWiki } = useMcWikiRoute()
    const { $t } = useI18n()
    const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.source.tags, set(v) { context.emit('tags', v) } }))

    const iconImage: Ref<HTMLImageElement | null> = ref(null)
    const enabled = computed({
      get() { return props.source.enabled },
      set(v: boolean) { context.emit('enable', { item: props.source, enabled: v }) },
    })

    const compatibleText = computed(() => {
      const deps = props.source.dependencies
      let acceptVersionText = $t('mod.acceptVersion', { version: deps.minecraft })
      if (deps.forge) {
        acceptVersionText += `, Forge ${deps.forge} (${forge.value})`
      }
      if (deps.fabricLoader) {
        acceptVersionText += `, FabricLoader ${deps.fabricLoader} (${fabricLoader.value})`
      }
      const compatibleText = compatible.value === 'maybe'
        ? $t('mod.nocompatible')
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
      context.emit('dragstart', e)
    }
    function onEditTag(event: Event, index: number) {
      if (event.target instanceof HTMLDivElement) {
        editTag(event.target.innerText, index)
      }
    }
    function onContextMenu(e: MouseEvent) {
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
      items.push({
        text: $t('mod.searchOnMcWiki', { name: props.source.name }),
        children: [],
        onClick: () => {
          searchMcWiki(props.source.name)
        },
        icon: 'search',
      })
      open(e.clientX, e.clientY, items)
    }
    function emitSelect() {
      context.emit('select')
    }

    return {
      iconImage,
      compatible,
      onDragStart,
      minecraft,
      onContextMenu,
      unknownPack,
      onDeleteTag: removeTag,
      onEditTag,

      enabled,
      compatibleText,
      emitSelect,
      getColor,
    }
  },
})
</script>

<style scoped=true>
.draggable-card:hover {
  background-color: #388e3c;
}

.unknown:hover {
  background-color: #bb724b;
}
.maybe:hover {
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
