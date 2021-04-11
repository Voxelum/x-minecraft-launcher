<template>
  <v-list-tile
    :key="source.type"
    :class="{
      grey: selected.type === source.type && selected.patch === source.patch,
      'darken-1':
        selected.patch === source.patch && selected.type === source.type,
    }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <v-icon>
        {{ icon }}
      </v-icon>
      <!-- <v-progress-circular
        v-else
        :width="2"
        :size="24"
        indeterminate
      /> -->
    </v-list-tile-avatar>

    <v-list-tile-title> {{ source.mcversion }}_{{ source.type }}_{{ source.patch }}</v-list-tile-title>
  </v-list-tile>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { required } from '/@/util/props'
import { Status } from '/@shared/entities/version'
import { OptifineVersion } from '/@shared/entities/version.schema'

export default defineComponent({
  props: {
    statuses: required<Record<string, Status>>(Object),
    source: required<OptifineVersion>(Object),
    selected: required<OptifineVersion>(Object),
    select: required<(version: OptifineVersion) => void>(Function),
  },
  setup(props) {
    const key = computed(() => props.source.mcversion + '_' + props.source.type + '_' + props.source.patch)
    const icon = computed(() => props.statuses[key.value] === 'remote' ? 'cloud' : 'folder')
    return { icon }
  },
})

</script>
