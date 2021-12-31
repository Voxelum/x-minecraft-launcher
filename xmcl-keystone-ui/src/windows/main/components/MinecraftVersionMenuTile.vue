<template>
  <v-list-tile
    :key="source.id"
    ripple
    @click="select(source)"
  >
    <v-list-tile-title class="flex gap-2 pl-3">{{ source.id }}</v-list-tile-title>
    <v-list-tile-action class="flex justify-end">
      <v-chip :color="source.type === 'release' ? 'primary' : ''" label dark>{{ type }}</v-chip>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { useI18n } from '/@/hooks'
import { required } from '/@/util/props'

export default defineComponent({
  components: {},
  props: {
    source: required<MinecraftVersion>(Object),
    select: required<(version: MinecraftVersion) => void>(Function),
  },
  setup(props) {
    const { $t } = useI18n()
    const type = computed(() => props.source.type === 'snapshot' ? $t('minecraft.versions.snapshot') : props.source.type === 'release' ? $t('minecraft.versions.release') : '')
    const onClick = (version: MinecraftVersion) => {
      // if (props.statuses[props.source.id] === 'remote') {
      //   props.install(version)
      // }
    }
    return { onClick, type }
  },
})
</script>

<style>
</style>
