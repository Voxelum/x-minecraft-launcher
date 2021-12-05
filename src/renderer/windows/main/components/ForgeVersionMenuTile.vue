<template>
  <v-list-tile :key="source.version" ripple @click="select(source)">
    <v-list-tile-title class="pl-3">{{ source.version }}</v-list-tile-title>

    <v-list-tile-action style="justify-content: flex-end;">
      <v-chip
        v-if="source.type !== 'common'"
        label
        :color="source.type === 'recommended' ? 'green' : ''"
      >{{ source.type }}</v-chip>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { required } from '/@/util/props'
import { Status } from '/@shared/entities/version'
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
