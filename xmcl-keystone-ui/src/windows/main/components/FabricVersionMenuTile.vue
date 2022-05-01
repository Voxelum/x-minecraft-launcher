<template>
  <v-list-item
    :key="source.version"
    ripple
    @click="select(source)"
  >
    {{ source.version }}
    <div class="flex-grow" />
    <v-chip
      v-if="source.stable"
      label
      color="green"
    >
      {{ $t('fabricVersion.stable') }}
    </v-chip>
    <v-chip
      v-else
      label
    >
      {{ $t('fabricVersion.unstable') }}
    </v-chip>
  </v-list-item>
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
