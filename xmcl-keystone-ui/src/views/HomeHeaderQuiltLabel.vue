<template>
  <v-chip
    v-if="quiltLoader"
    label
    outlined
    @click="onClick();"
  >
    <v-avatar :left="!!quiltLoader">
      <img
        :src="'image://builtin/quilt'"
      >
    </v-avatar>
    <div v-if="quiltLoader">
      Quilt
      {{ quiltLoader }}
    </div>
  </v-chip>
</template>

<script lang=ts setup>

defineProps<{
  quiltLoader: string | undefined
}>()

const { t } = useI18n()

const onClick = () => {
}

</script>
