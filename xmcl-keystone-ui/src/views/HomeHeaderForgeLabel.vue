<template>
  <v-chip
    v-if="forge"
    label
    outlined
    @click="onClick()"
  >
    <v-avatar :left="!!forge">
      <img
        :src="'image://builtin/forge'"
        alt="forge"
      >
    </v-avatar>
    <div v-if="forge">
      Forge
      {{ forge }}
    </div>
  </v-chip>
</template>

<script lang=ts setup>

defineProps<{
  minecraft: string
  forge: string | undefined
}>()

const emit = defineEmits(['select'])
const { t } = useI18n()

const onClick = () => {
}

</script>
