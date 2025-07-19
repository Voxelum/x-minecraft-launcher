<script setup lang="ts">
import { RuntimeVersions } from '@xmcl/runtime-api'
import { BuiltinImages } from '../constant'

defineProps<{
  icon?: string
  name: string
  runtime: RuntimeVersions
  value?: boolean
  description?: string
}>()

defineEmits(['input', 'select'])

</script>

<template>
  <v-list-item
    ripple
    :title="name"
    @click="$emit('select')"
  >
    <template #prepend>
      <v-avatar>
        <v-img
          :src="icon ? icon : ''"
        />
      </v-avatar>
    </template>
    <template #subtitle>
      <v-list-item-subtitle class="flex gap-1">
        <v-chip
          v-if="runtime.minecraft"
          variant="outlined"
          size="small"
          label
        >
          <v-avatar start>
            <img
              :src="BuiltinImages.minecraft"
              alt="minecraft"
            >
          </v-avatar>
          {{ runtime.minecraft }}
        </v-chip>
        <v-chip
          v-if="runtime.forge"
          variant="outlined"
          size="small"
          label
        >
          <v-avatar start>
            <img
              :src="BuiltinImages.forge"
              alt="forge"
            >
          </v-avatar>
          {{ runtime.forge }}
        </v-chip>
        <v-chip
          v-if="runtime.fabricLoader"
          variant="outlined"
          size="small"
          label
        >
          <v-avatar start>
            <img
              :src="BuiltinImages.fabric"
              alt="fabric"
            >
          </v-avatar>
          {{ runtime.fabricLoader }}
        </v-chip>

        <v-chip
          v-if="runtime.neoForged"
          variant="outlined"
          size="small"
          label
        >
          <v-avatar start>
            <img
              :src="BuiltinImages.neoForged"
            >
          </v-avatar>
          {{ runtime.neoForged }}
        </v-chip>

        <v-chip
          v-if="runtime.quiltLoader"
          variant="outlined"
          size="small"
          label
        >
          <v-avatar start>
            <img
              :src="BuiltinImages.quilt"
            >
          </v-avatar>
          {{ runtime.quiltLoader }}
        </v-chip>
      </v-list-item-subtitle>
    </template>

    <v-list-item-action>
      <v-list-item-action-text>{{ description }}</v-list-item-action-text>
    </v-list-item-action>
    <v-list-item-action>
      <v-checkbox
        :value="value"
        :model-value="value"
        readonly
        @input="$emit('input', !value)"
      />
    </v-list-item-action>
  </v-list-item>
</template>
