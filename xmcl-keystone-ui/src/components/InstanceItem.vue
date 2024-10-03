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
    @click="$emit('select')"
  >
    <v-list-item-avatar>
      <v-img
        :src="icon ? icon : ''"
      />
    </v-list-item-avatar>

    <v-list-item-content>
      <v-list-item-title>{{ name }}</v-list-item-title>
      <v-list-item-subtitle class="flex gap-1">
        <v-chip
          v-if="runtime.minecraft"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="BuiltinImages.minecraft"
              alt="minecraft"
            >
          </v-avatar>
          {{ runtime.minecraft }}
        </v-chip>
        <v-chip
          v-if="runtime.forge"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="BuiltinImages.forge"
              alt="forge"
            >
          </v-avatar>
          {{ runtime.forge }}
        </v-chip>
        <v-chip
          v-if="runtime.fabricLoader"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="BuiltinImages.fabric"
              alt="fabric"
            >
          </v-avatar>
          {{ runtime.fabricLoader }}
        </v-chip>

        <v-chip
          v-if="runtime.neoForged"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="BuiltinImages.neoForged"
            >
          </v-avatar>
          {{ runtime.neoForged }}
        </v-chip>

        <v-chip
          v-if="runtime.quiltLoader"
          outlined
          small
          label
        >
          <v-avatar left>
            <img
              :src="BuiltinImages.quilt"
            >
          </v-avatar>
          {{ runtime.quiltLoader }}
        </v-chip>
      </v-list-item-subtitle>
    </v-list-item-content>

    <v-list-item-action>
      <v-list-item-action-text>{{ description }}</v-list-item-action-text>
    </v-list-item-action>
    <v-list-item-action>
      <v-checkbox
        :value="value"
        :input-value="value"
        readonly
        @input="$emit('input', !value)"
      />
    </v-list-item-action>
  </v-list-item>
</template>
