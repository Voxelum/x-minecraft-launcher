<template>
  <v-list-tile
    :key="source.type"
    :class="{
      grey: isSelected,
      'darken-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <!-- <v-chip label v-if=""></v-chip> -->
    </v-list-tile-avatar>

    <v-list-tile-title>{{ source.mcversion }}_{{ source.type }}_{{ source.patch }}</v-list-tile-title>
    <v-list-tile-sub-title>{{ source.patch }}</v-list-tile-sub-title>
    <v-list-tile-action class="flex justify-end">
      <v-btn icon :loading="installing" @click.stop="onClick(source)">
        <v-icon>{{ status === "remote" ? "file_download" : "folder" }}</v-icon>
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { useBusy } from '/@/hooks'
import { required } from '/@/util/props'
import { Status } from '/@shared/entities/version'
import { OptifineVersion } from '/@shared/entities/version.schema'
import { versionLockOf, write } from '/@shared/util/mutex'

export default defineComponent({
  props: {
    statuses: required<Record<string, Status>>(Object),
    source: required<OptifineVersion>(Object),
    selected: required<OptifineVersion>(Object),
    minecraft: required(String),
    select: required<(version: OptifineVersion) => void>(Function),
    install: required<(version: OptifineVersion) => void>(Function),
  },
  setup(props) {
    const key = computed(() => props.source.mcversion + '_' + props.source.type + '_' + props.source.patch)
    const status = computed(() => props.statuses[key.value])
    const resourceKey = write(versionLockOf(`optifine-${props.minecraft}-${props.source.type}_${props.source.patch}`))
    const installing = useBusy(resourceKey)
    const isSelected = computed(() => props.selected.type === props.source.type && props.selected.patch === props.source.patch)
    const onClick = (version: OptifineVersion) => {
      if (status.value === 'remote') {
        props.install(version)
      }
    }
    return { computed, installing, isSelected, status, onClick }
  },
})

</script>
