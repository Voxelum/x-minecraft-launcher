<template>
  <v-list-item
    :key="item.id"
    class="h-[50px] flex-1 flex-grow-0"
    @click="openVersionDir(item)"
  >
    <v-list-item-avatar>
      <v-icon>
        {{ icon }}
      </v-icon>
    </v-list-item-avatar>
    <v-list-item-title
      style="flex: 1 1 50%"
      class="!flex-grow-0"
    >
      {{ item.id }}
    </v-list-item-title>
    <v-list-item-subtitle class="flex !flex-grow">
      {{ item.minecraft }}
    </v-list-item-subtitle>
    <v-list-item-action style="flex-direction: row; justify-content: flex-end;">
      <v-btn
        style="cursor: pointer"
        icon
        text
        @mousedown.stop
        @click.stop="startReinstall(item)"
      >
        <v-icon>build</v-icon>
      </v-btn>
    </v-list-item-action>
    <v-list-item-action style="flex-direction: row; justify-content: flex-end;">
      <v-btn
        style="cursor: pointer"
        icon
        color="error"
        text
        @mousedown.stop
        @click.stop="startDelete(item)"
      >
        <v-icon>delete</v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script setup lang="ts">
import { LocalVersionHeader } from '@xmcl/runtime-api'

const props = defineProps<{
  item: LocalVersionHeader
  openVersionDir: (v: LocalVersionHeader) => void
  startReinstall: (v: LocalVersionHeader) => void
  startDelete: (v: LocalVersionHeader) => void
}>()

const icon = computed(() => {
  if (props.item.forge) return '$vuetify.icons.forge'
  if (props.item.fabric) return '$vuetify.icons.fabric'
  if (props.item.quilt) return '$vuetify.icons.quilt'
  if (props.item.optifine) return '$vuetify.icons.optifine'
  if (props.item.neoForged) return '$vuetify.icons.neoForged'
  return '$vuetify.icons.minecraft'
})
</script>
