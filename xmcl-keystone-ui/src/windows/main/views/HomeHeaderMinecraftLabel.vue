<template>
  <v-chip
    label
    outlined
    :small="small"
    @click="onClick()"
  >
    <v-avatar left>
      <img
        :src="'image:builtin:minecraft'"
      >
    </v-avatar>
    Minecraft
    {{ minecraft }}
  </v-chip>
</template>

<script lang=ts setup>
import { useI18n } from '/@/composables'
defineProps<{
  minecraft: string
  small?: boolean
}>()
const { t } = useI18n()

const onClick = () => {
}

</script>
