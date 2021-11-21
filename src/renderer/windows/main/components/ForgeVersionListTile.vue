<template>
  <v-list-tile
    :key="source.version"
    :class="{
      grey: isSelected,
      'darken-1': isSelected,
      'elevation-2': isSelected,
    }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <v-chip
        v-if="source.type !== 'common'"
        label
        :color="source.type === 'recommended' ? 'green' : ''"
      >{{ source.type }}</v-chip>
    </v-list-tile-avatar>

    <v-list-tile-title>{{ source.version }}</v-list-tile-title>
    <v-list-tile-sub-title>{{ source.date ? new Date(source.date).toLocaleString() : source.date }}</v-list-tile-sub-title>

    <v-list-tile-action style="justify-content: flex-end;">
      <v-btn :loading="installing" icon @click="onClick">
        <v-icon>
          {{
            source.status === "remote" ? "file_download" : "folder"
          }}
        </v-icon>
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { required } from '/@/util/props'
import { Status } from '/@shared/entities/version'
import { computed, defineComponent } from '@vue/composition-api'
import { ForgeVersion } from '@xmcl/installer'
import { useBusy } from '/@/hooks'
import { versionLockOf, write } from '/@shared/util/mutex'

export default defineComponent({
  props: {
    source: required<ForgeVersion & { status: Status; date: string }>(Object),
    select: required<(version: { version: string }) => void>(Function),
    install: required<(version: { version: string }) => void>(Function),
    selected: required(String),
  },
  setup(props) {
    const key = write(versionLockOf(`forge-${props.source.mcversion}-${props.source.version}`))
    const installing = useBusy(key)
    const isSelected = computed(() => props.selected === props.source.version)
    const onClick = () => {
      if (props.source.status === "remote") {
        props.install(props.source)
      }
    }
    return {
      isSelected,
      installing,
      onClick,
    }
  },
})
</script>
