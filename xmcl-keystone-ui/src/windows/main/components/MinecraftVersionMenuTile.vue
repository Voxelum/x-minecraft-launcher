<template>
  <v-list-item
    :key="source.id"
    ripple
    @click="select(source)"
  >
    {{ source.id }}
    <div class="flex-grow" />
    <v-chip
      :color="source.type === 'release' ? 'primary' : ''"
      label
    >
      {{ type }}
    </v-chip>
  </v-list-item>
</template>

<script lang=ts>
import { computed, defineComponent } from '@vue/composition-api'
import { MinecraftVersion } from '@xmcl/installer'
import { useI18n } from '/@/composables'
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
