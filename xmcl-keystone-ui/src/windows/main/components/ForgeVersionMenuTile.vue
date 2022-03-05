<template>
  <v-list-item
    :key="source.version"
    class="flex"
    ripple
    @click="select(source)"
  >
    {{ source.version }}
    <div class="flex-grow" />

    <v-chip
      v-if="source.type !== 'common'"
      label
      :color="source.type === 'recommended' ? 'green' : ''"
    >
      {{ source.type }}
    </v-chip>
  </v-list-item>
</template>

<script lang=ts>
import { required } from '/@/util/props'
import { Status } from '@xmcl/runtime-api'
import { computed, defineComponent } from '@vue/composition-api'
import { ForgeVersion } from '@xmcl/installer'

export default defineComponent({
  props: {
    source: required<ForgeVersion & { status: Status; date: string }>(Object),
    select: required<(version: { version: string }) => void>(Function),
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
