<template>
  <v-list-tile
    :key="source.version"
    ripple
    @click="select(source)"
  >
    <v-list-tile-title class="pl-3">
      {{ source.version }}
    </v-list-tile-title>
    <v-list-tile-action style="justify-content: flex-end;">
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
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { FabricArtifactVersion } from '@xmcl/installer'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    source: required<FabricArtifactVersion>(Object),
    select: required<(version: FabricArtifactVersion) => void>(Function),
  },
  setup(props) {
    const onClick = () => {
    }
    return {
      onClick,
    }
  },
})

</script>
