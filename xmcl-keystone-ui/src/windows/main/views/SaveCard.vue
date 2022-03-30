<template>
  <v-card
    v-draggable-card
    v-data-transfer:id="source.name"
    v-data-transfer-image="icon"
    hover
    outlined
    draggable
    class="white--text draggable-card"
    style="margin-top: 10px; padding: 0 10px; transition-duration: 0.2s; margin-bottom: 20px"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
  >
    <v-layout
      justify-center
      align-center
      fill-height
    >
      <v-flex
        class="m-0 p-2"
        xs3
        md2
      >
        <img
          ref="icon"
          v-fallback-img="unknownPack"
          class="rounded-lg"
          :src="source.icon"
          style="min-height: 126px; max-height: 126px; max-width: 126px; min-width: 126px"
          contain
        >
      </v-flex>
      <v-flex class="flex-grow py-2 flex-col gap-3">
        <h3>{{ source.name }}</h3>
        <div class="dark:text-gray-400">
          {{ new Date(source.lastPlayed) }}
        </div>
        <div class="flex gap-2">
          <v-chip
            small
            outlined
            label
            color="amber"
            style="margin-left: 1px;"
          >
            {{ levelMode }}
          </v-chip>
          <v-chip
            v-if="source.cheat"
            small
            outlined
            color="orange en-1"
            label
            style="margin-left: 1px;"
          >
            {{ $t('gamesetting.cheat') }}
          </v-chip>
          <v-chip
            small
            outlined
            label
            color="lime"
            style="margin-left: 1px;"
          >
            {{ source.gameVersion }}
          </v-chip>
        </div>
        <!-- <div style="color: #bdbdbd; ">{{ source.description }}</div> -->
      </v-flex>
      <v-flex style="flex-grow: 0">
        <v-btn
          text
          icon
          @click="exportSave(source.path)"
        >
          <v-icon>launch</v-icon>
          <!-- {{ $t('save.export') }} -->
        </v-btn>
      </v-flex>
    </v-layout>
  </v-card>
</template>

<script lang=ts>
import { defineComponent, computed, ref } from '@vue/composition-api'
import { InstanceSaveMetadata } from '@xmcl/runtime-api'
import unknownPack from '/@/assets/unknown_pack.png'
import { required } from '/@/util/props'
import { useI18n } from '/@/composables'

export default defineComponent({
  props: {
    exportSave: required<(path: string) => void>(Function),
    // deleteSave: required<(path: string) => void>(Function),
    source: required<InstanceSaveMetadata>(Object),
  },
  setup(props) {
    const { $t } = useI18n()
    const levelMode = computed(() => {
      switch (props.source.mode) {
        case 0: return $t('gamesetting.gametype.survival')
        case 1: return $t('gamesetting.gametype.creative')
        case 2: return $t('gamesetting.gametype.adventure')
        case 3: return $t('gamesetting.gametype.spectator')
        case -1:
        default:
          return $t('gamesetting.gametype.non')
      }
    })
    return {
      unknownPack,
      levelMode,
      icon: ref(null),
    }
  },
})
</script>

<style>
</style>
