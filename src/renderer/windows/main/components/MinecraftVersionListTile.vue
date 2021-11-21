<template>
  <v-list-tile
    :key="source.id"
    :class="{
      grey: isSelected,
      'darken-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <v-chip :color="source.type === 'release' ? 'primary' : ''" label dark>{{ source.type }}</v-chip>
    </v-list-tile-avatar>

    <v-list-tile-title class="flex gap-2 pl-3">{{ source.id }}</v-list-tile-title>
    <v-list-tile-sub-title v-if="showTime">
      {{
        new Date(source.releaseTime).toLocaleString()
      }}
    </v-list-tile-sub-title>
    <v-list-tile-action style="justify-content: flex-end; " class="flex">
      <!-- <v-progress-circular v-else :width="2" :size="24" indeterminate /> -->
      <v-btn icon :loading="installing" @click.stop="onClick(source)">
        <v-icon>{{ statuses[source.id] === "remote" ? "file_download" : "folder" }}</v-icon>
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { useBusy } from '/@/hooks'
import { required, withDefault } from '/@/util/props'
import { Status } from '/@shared/entities/version'
import { versionLockOf, write } from '/@shared/util/mutex'

export default defineComponent({
  components: {},
  props: {
    showTime: withDefault(Boolean, () => true),
    source: required<MinecraftVersion>(Object),
    selected: required(String),
    select: required<(version: MinecraftVersion) => void>(Function),
    install: required<(version: MinecraftVersion) => void>(Function),
    statuses: required<Record<string, Status>>(Object),
  },
  setup(props) {
    const key = write(versionLockOf(props.source.id))
    const installing = useBusy(key)
    const isSelected = computed(() => props.source.id === props.selected)
    const onClick = (version: MinecraftVersion) => {
      if (props.statuses[props.source.id] === 'remote') {
        props.install(version)
      }
    }
    return { installing, isSelected, onClick }
  },
})
</script>

<style>
</style>
