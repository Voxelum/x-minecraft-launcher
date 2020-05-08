<template>
  <v-card
    ref="card"
    v-draggable-card
    hover
    draggable
    :dark="!source.subsequence"
    :class="{ 
      grey: source.subsequence,
      'darken-2': source.subsequence,
      incompatible: compatible === false,
      maybe: compatible === 'maybe',
      unknown: compatible === 'unknown', 
      subsequence: source.subsequence,
    }"
    class="white--text draggable-card"
    style="margin-top: 10px; padding: 0 10px; transition-duration: 0.2s;"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @mouseenter="hoveringMod = source.id"
    @mouseleave="hoveringMod = ''"
    @contextmenu="tryOpen"
    @click="$emit('click', $event);"
  >
    <v-tooltip top>
      <template v-slot:activator="{ on }">
        <v-layout
          justify-center
          align-center
          fill-height
          v-on="on"
        >
          <!-- <v-flex style="flex-grow: 0">
            <v-checkbox></v-checkbox>
          </v-flex>-->
          <v-flex
            v-if="!source.subsequence"
            style="margin: 0 10px 0 0; min-height: 126px; max-height: 126px; max-width: 126px; min-width; 126px"
          >
            <img
              ref="iconImage"
              v-fallback-img="unknownPack"
              :src="source.icon"
              style="min-height: 126px; max-height: 126px; max-width: 126px; min-width; 126px"
              contain
            />
          </v-flex>
          <v-flex style="padding: 10px 0; flex-grow: 1">
            <h3 v-if="!source.subsequence">{{ source.name }}</h3>
            <v-chip
              small
              outline
              label
              color="amber"
              style="margin-left: 1px;"
            >{{ source.version }}</v-chip>
            <v-chip
              small
              outline
              color="orange darken-1"
              label
              style="margin-left: 1px;"
            >{{ source.id }}</v-chip>
            <v-chip
              small
              outline
              label
              color="lime"
              style="margin-left: 1px;"
            >{{ source.type }}</v-chip>
            <div style="color: #bdbdbd; ">{{ source.description }}</div>
          </v-flex>
          <v-flex style="flex-grow: 0">
            <v-switch v-model="enabled"></v-switch>
          </v-flex>
        </v-layout>
      </template>
      {{ compatibleText }}
      <v-divider />
    </v-tooltip>
  </v-card>
</template>

<script lang=ts>
import { defineComponent, ref, Ref, computed, inject, watch } from '@vue/composition-api';
import { useInstanceVersionBase, useDragTransferItemMutable, useCompatible, useService, ModItem, useI18n } from '@/hooks';
import { basename } from '@/util/basename';
import unknownPack from '@/assets/unknown_pack.png';
import { useContextMenu, ContextMenuItem, useCurseforgeRoute } from '../hooks';

export interface Props {
  source: ModItem;
}

export default defineComponent<Props>({
  props: {
    source: {
      required: true,
      type: Object,
      default: () => ({}),
    },
  },
  setup(props, context) {
    const { minecraft, forge } = useInstanceVersionBase();
    const enabled = ref(props.source.enabled);

    const { compatible: mcCompatible } = useCompatible(computed(() => props.source.acceptVersion),
      minecraft, true);
    const { compatible: loaderCompatible } = useCompatible(computed(() => props.source.acceptLoaderVersion),
      forge, false);
    const { open } = useContextMenu();
    const compatible = computed(() => {
      if (mcCompatible.value === true) {
        if (loaderCompatible.value === true) {
          return true;
        }
        return 'maybe';
      }
      if (mcCompatible.value === 'unknown') {
        if (loaderCompatible.value === true) {
          return true;
        }
        return 'unknown';
      }
      return false;
    });
    const { openInBrowser, showItemInDirectory } = useService('BaseService');
    const iconImage: Ref<HTMLImageElement | null> = ref(null);
    const card: Ref<Vue | null> = ref(null);

    const modified = inject('Modified', ref([] as ModItem[]));
    const isDraggingMod = inject('DraggingMod', ref(false));
    const hoveringMod = inject('HoveringMod', ref(''));
    const { searchProjectAndRoute, goProjectAndRoute } = useCurseforgeRoute();

    const { $t } = useI18n();

    const compatibleText = computed(() => {
      let acceptVersionText = $t('mod.acceptVersion', { version: props.source.acceptVersion, loaderVersion: props.source.acceptLoaderVersion });
      let compatibleText = compatible.value === 'unknown'
        ? $t('mod.nocompatible')
        : compatible.value
          ? $t('mod.compatible')
          : $t('mod.incompatible');
      return compatibleText + acceptVersionText;
    });

    watch([enabled, computed(() => props.source.enabled)], ([newValue], old) => {
      if (typeof old === 'undefined') return;
      if (enabled.value !== props.source.enabled) {
        modified.value.push({ ...props.source, enabled: newValue });
      } else {
        modified.value = modified.value.filter((m) => m.id !== props.source.id);
      }
    });

    // useDragTransferItemMutable(
    //   computed(() => card.value?.$el as HTMLElement),
    //   computed(() => ({ side: props.isSelected ? 'right' : 'left', id: props.source.url })),
    // );

    function onDragStart(e: DragEvent) {
      if (iconImage.value) {
        e.dataTransfer!.setDragImage(iconImage.value!, 0, 0);
      } else {
        let img = document.createElement('img');
        img.src = props.source.icon;
        img.style.maxHeight = '126px';
        img.style.maxWidth = '126px';
        img.style.objectFit = 'contain';

        e.dataTransfer!.setDragImage(img, 0, 0);
      }
      e.dataTransfer!.setData('id', props.source.url);
      isDraggingMod.value = true;
      context.emit('dragstart', e);
    }
    function onDragEnd() {
      isDraggingMod.value = true;
    }
    function tryOpen(e: MouseEvent) {
      let items: ContextMenuItem[] = [{
        text: $t('mod.showFile', { file: props.source.path }),
        children: [],
        onClick: () => {
          showItemInDirectory(props.source.path);
        },
        icon: 'folder',
      }];
      if (props.source.resource.source.uri.find(u => u.startsWith('http'))) {
        let url = props.source.resource.source.uri.find(u => u.startsWith('http'))!;
        items.push({
          text: $t('mod.openLink', { url }),
          children: [],
          onClick: () => {
            openInBrowser(url);
          },
          icon: 'link',
        });
      }
      if (props.source.resource.source.curseforge) {
        items.push({
          text: $t('mod.showInCurseforge', { name: props.source.name }),
          children: [],
          onClick: () => {
            goProjectAndRoute(props.source.resource.source.curseforge!.projectId, 'mc-mods');
          },
          icon: '$vuetify.icons.curseforge',
        });
      } else {
        items.push({
          text: $t('mod.searchOnCurseforge', { name: props.source.name }),
          children: [],
          onClick: () => {
            searchProjectAndRoute(props.source.name, 'mc-mods');
          },
          icon: 'search',
        });
      }
      open(e.clientX, e.clientY, items);
    }

    return {
      card,
      iconImage,
      compatible,
      onDragEnd,
      onDragStart,
      minecraft,
      tryOpen,
      basename,
      enabled,
      hoveringMod,
      unknownPack,

      mcCompatible,
      compatibleText,
    };
  },
});
</script>

<style scoped=true>
.draggable-card:hover {
  background-color: #388e3c;
}

.unknown:hover {
  background-color: #c24f11b6;
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
.subsequence.incompatible.draggable-card:hover {
  background-color: #e65100 !important;
}
</style>
