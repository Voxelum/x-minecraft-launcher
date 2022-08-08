<template>
  <v-chip
    v-if="fabricLoader"
    label
    outlined
    @click="onClick()"
  >
    <v-avatar :left="!!fabricLoader">
      <img :src="fabricPng">
    </v-avatar>
    <div v-if="fabricLoader">
      Fabric
      {{ fabricLoader }}
    </div>
  </v-chip>
</template>

<script lang=ts setup>
import fabricPng from '/@/assets/fabric.png'
import { useI18n } from '/@/composables'
defineProps<{
  minecraft: string
  fabricLoader: string | undefined
}>()

const { t } = useI18n()

const onClick = () => {
}

</script>
