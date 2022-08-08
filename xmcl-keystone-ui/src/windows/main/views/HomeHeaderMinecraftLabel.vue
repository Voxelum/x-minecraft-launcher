<template>
  <v-chip
    label
    outlined
    @click="onClick()"
  >
    <v-avatar left>
      <img
        :src="minecraftPng"
      >
    </v-avatar>
    Minecraft
    {{ minecraft }}
  </v-chip>
</template>

<script lang=ts setup>
import minecraftPng from '/@/assets/minecraft.png'
import { useI18n } from '/@/composables'
defineProps<{
  minecraft: string
}>()
const { t } = useI18n()

const onClick = () => {
}

</script>
