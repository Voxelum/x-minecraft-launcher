<template>
  <v-chip
    v-if="quiltLoader"
    label
    outlined
    @click="onClick();"
  >
    <v-avatar :left="!!quiltLoader">
      <img
        :src="'image:builtin:quilt'"
      >
    </v-avatar>
    <div v-if="quiltLoader">
      Quilt
      {{ quiltLoader }}
    </div>
  </v-chip>
</template>

<script lang=ts setup>
import { useI18n } from '/@/composables'
defineProps<{
  minecraft: string
  quiltLoader: string | undefined
}>()

const { t } = useI18n()

const onClick = () => {
}

</script>
