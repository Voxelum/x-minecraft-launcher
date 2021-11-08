<template>
  <v-card
    v-selectable-card
    v-long-press="emitSelect"
    hover
    :draggable="!mod.enabled"
    :dark="!mod.subsequence"
    :class="{
      incompatible: compatible === false,
      maybe: compatible === 'maybe',
      unknown: compatible === 'unknown',
      subsequence: mod.subsequence === true,
      dragged: mod.dragged
    }"
    class="white--text draggable-card mod-card"
    style="margin-top: 10px; padding: 0 10px; transition-duration: 0.2s;"
    @dragstart="onDragStart"
    @dragend="$emit('dragend', $event)"
    @mouseenter="$emit('mouseenter', $event)"
    @contextmenu="onContextMenu"
    @click="$emit('click', $event)"
  >
    <v-tooltip top>
      <template #activator="{ on }">
        <transition-group
          class="layout justify-center align-center fill-height"
          name="transition-list"
          tag="div"
          style="user-select: none"
        >
          <v-flex v-if="selection" :key="0" class="flex-grow-0">
            <v-checkbox :value="mod.selected" />
          </v-flex>
          <v-flex v-if="!mod.subsequence" :key="1" class="avatar">
            <img ref="iconImage" v-fallback-img="unknownPack" :src="mod.icon" contain />
          </v-flex>
          <div :key="2" class="flex-grow py-2" v-on="on">
            <h3 class="text-lg font-bold" v-if="!mod.subsequence">{{ mod.name }}</h3>
            <v-chip
              small
              outline
              label
              color="amber"
              style="margin-left: 1px;"
              @mousedown.stop
            >{{ mod.version }}</v-chip>
            <v-chip
              small
              outline
              color="orange darken-1"
              label
              @mousedown.stop
              style="margin-left: 1px;"
            >{{ mod.id }}</v-chip>
            <v-chip
              small
              outline
              label
              color="lime"
              style="margin-left: 1px;"
              @mousedown.stop
            >{{ mod.type }}</v-chip>

            <v-chip
              v-for="(tag, index) in mod.tags"
              :key="`${tag}-${index}`"
              small
              outline
              label
              color="lime"
              style="margin-left: 1px;"
              @mousedown.stop
              close
              @input="onDeleteTag(tag)"
            >
              <div
                contenteditable
                class="max-w-50 overflow-auto"
                @input.stop="onEditTag($event, index)"
              >{{ tag }}</div>
            </v-chip>
            <div style="color: #bdbdbd; ">{{ mod.description }}</div>
          </div>
          <v-flex :key="3" style="flex-grow: 0" @click.stop @mousedown.stop>
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
import { required } from '/@/util/props'
import { ContextMenuItem, useContextMenu, useCurseforgeRoute, useMcWikiRoute } from '/@/windows/main/hooks'
import { BaseServiceKey } from '/@shared/services/BaseService'

export default defineComponent({
  props: {
    mod: required<ModItem>(Object),
    selection: required<boolean>(Boolean),
  },
  setup(props, context) {
    const { minecraft, forge } = useInstanceVersionBase()
    const { compatible: mcCompatible } = useCompatible(computed(() => props.mod.dependencies.minecraft), minecraft, true)
    const { compatible: loaderCompatible } = useCompatible(computed(() => props.mod.dependencies.forge ?? ''), computed(() => forge.value || ''), false)
    const { open } = useContextMenu()
    const { openInBrowser, showItemInDirectory } = useService(BaseServiceKey)
    const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute()
    const { searchProjectAndRoute: searchMcWiki } = useMcWikiRoute()
    const { $t } = useI18n()
    const { createTag, editTag, removeTag } = useTags(computed({ get: () => props.mod.tags, set(v) { props.mod.tags = v } }))

    const iconImage: Ref<HTMLImageElement | null> = ref(null)
    const enabled = computed({
      get() { return props.mod.enabled },
      set(v: boolean) { context.emit('enable', { item: props.mod, enabled: v }) }
    })

    const compatible = computed(() => {
      if (mcCompatible.value === true) {
        if (loaderCompatible.value === true) {
          return true
        }
        return 'maybe'
      }
      if (mcCompatible.value === 'unknown') {
        if (loaderCompatible.value === true) {
          return true
        }
        return 'unknown'
      }
      return false
    })

    const compatibleText = computed(() => {
      const deps = props.mod.dependencies
      let acceptVersionText = $t('mod.acceptVersion', { version: deps.minecraft })
      if (deps.forge) {
        acceptVersionText += `, Forge ${deps.forge}`
      }
      if (deps.fabricLoader) {
        acceptVersionText += `, FabricLoader ${deps.fabricLoader}`
      }
      const compatibleText = compatible.value === 'unknown'
        ? $t('mod.nocompatible')
        : compatible.value
          ? $t('mod.compatible')
          : $t('mod.incompatible')
      return compatibleText + acceptVersionText
    })

    function onDragStart(e: DragEvent) {
      if (props.mod.enabled) {
        return
      }
      if (iconImage.value) {
        e.dataTransfer!.setDragImage(iconImage.value!, 0, 0)
      } else {
        const img = document.createElement('img')
        img.src = props.mod.icon
        img.style.maxHeight = '126px'
        img.style.maxWidth = '126px'
        img.style.objectFit = 'contain'

        e.dataTransfer!.setDragImage(img, 0, 0)
      }
      e.dataTransfer!.effectAllowed = 'move'
      e.dataTransfer!.setData('id', props.mod.url)
      context.emit('dragstart', e)
    }
    function onEditTag(event: InputEvent, index: number) {
      if (event.target instanceof HTMLDivElement) {
        editTag(event.target.innerText, index)
      }
    }
    function onContextMenu(e: MouseEvent) {
      const items: ContextMenuItem[] = [{
        text: $t('mod.showFile', { file: props.mod.path }),
        children: [],
        onClick: () => {
          showItemInDirectory(props.mod.path)
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
      if (props.mod.url) {
        const url = props.mod.url
        items.push({
          text: $t('mod.openLink', { url }),
          children: [],
          onClick: () => {
            openInBrowser(url)
          },
          icon: 'link',
        })
      }
      if (props.mod.curseforge) {
        const curseforge = props.mod.curseforge
        items.push({
          text: $t('mod.showInCurseforge', { name: props.mod.name }),
          children: [],
          onClick: () => {
            goProjectAndRoute(curseforge.projectId, 'mc-mods')
          },
          icon: '$vuetify.icons.curseforge',
        })
      } else {
        items.push({
          text: $t('mod.searchOnCurseforge', { name: props.mod.name }),
          children: [],
          onClick: () => {
            searchProjectAndRoute(props.mod.name, 'mc-mods')
          },
          icon: 'search',
        })
      }
      items.push({
        text: $t('mod.searchOnMcWiki', { name: props.mod.name }),
        children: [],
        onClick: () => {
          searchMcWiki(props.mod.name)
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

      mcCompatible,
      enabled,
      compatibleText,
      emitSelect,
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
