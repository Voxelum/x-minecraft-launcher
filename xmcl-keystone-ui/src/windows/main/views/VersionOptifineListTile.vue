<template>
  <v-list-item
    :key="source.type"
    :class="{
      grey: isSelected,
      'en-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <v-list-item-avatar>
      <!-- <v-chip label v-if=""></v-chip> -->
    </v-list-item-avatar>

    <v-list-item-title>{{ source.mcversion }}_{{ source.type }}_{{ source.patch }}</v-list-item-title>
    <v-list-item-subtitle>{{ source.patch }}</v-list-item-subtitle>
    <v-list-item-action class="flex justify-end">
      <v-btn
        icon
        :loading="installing"
        @click.stop="onClick(source)"
      >
        <v-icon>{{ status === "remote" ? "file_download" : "folder" }}</v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { OptifineVersion, Status, versionLockOf, write } from '@xmcl/runtime-api'
import { useBusy } from '/@/composables'
import { required } from '/@/util/props'

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
