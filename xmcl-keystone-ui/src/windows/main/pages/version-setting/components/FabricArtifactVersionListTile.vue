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
    <v-list-tile-avatar class="ml-1">
      <v-chip
        v-if="source.stable"
        label
        color="green"
      >
        {{ $t('fabric.version.stable') }}
      </v-chip>
      <v-chip
        v-else
        label
      >
        {{ $t('fabric.version.unstable') }}
      </v-chip>
    </v-list-tile-avatar>

    <v-list-tile-title class="pl-3">
      {{ source.version }}
    </v-list-tile-title>
    <v-list-tile-sub-title>{{ source.maven }}</v-list-tile-sub-title>

    <v-list-tile-action style="justify-content: flex-end;">
      <v-btn
        :loading="installing"
        icon
        @click="onClick"
      >
        <v-icon>
          {{
            statuses[source.version] === "remote" ? "file_download" : "folder"
          }}
        </v-icon>
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { FabricArtifactVersion } from '@xmcl/installer'
import { useBusy } from '/@/hooks'
import { required } from '/@/util/props'
import { versionLockOf, write } from '@xmcl/runtime-api/utils'

export default defineComponent({
  props: {
    statuses: required<Record<string, 'loading' | 'remote'>>(Object),
    source: required<FabricArtifactVersion>(Object),
    selected: required<string>(String),
    minecraft: required<string>(String),
    select: required<(version: FabricArtifactVersion) => void>(Function),
    install: required<(version: FabricArtifactVersion) => void>(Function),
  },
  setup(props) {
    const key = write(versionLockOf(`fabric-${props.minecraft}-${props.source.version}`))
    const installing = useBusy(key)
    const isSelected = computed(() => props.selected === props.source.version)
    const onClick = () => {
      if (props.statuses[props.source.version] === 'remote') {
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
