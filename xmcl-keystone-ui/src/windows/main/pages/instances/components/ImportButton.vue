<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        open-on-hover
        direction="bottom"
        transition="slide-y-reverse-transition"
      >
        <template #activator>
          <v-btn
            text
            fab

            small
            @click="$emit('import', 'normal')"
            v-on="on"
          >
            <v-icon
              style="font-size: 28px"
            >
              save_alt
            </v-icon>
          </v-btn>
        </template>

        <v-btn
          fab
          small
          @click="$emit('import', 'folder')"
        >
          <v-tooltip
            :close-delay="0"
            left
          >
            <template #activator="{ on: tooltip }">
              <v-icon
                v-on="tooltip"
              >
                folder
              </v-icon>
            </template>
            {{ $t('profile.importFolder') }}
          </v-tooltip>
        </v-btn>

        <v-btn
          fab
          small
          @click="$emit('import', 'curseforge')"
        >
          <v-tooltip
            :close-delay="0"
            left
          >
            <template #activator="{ on: tooltip }">
              <v-icon
                style="padding-right: 2px;"
                v-on="tooltip"
              >
                $vuetify.icons.curseforge
              </v-icon>
            </template>
            {{ $t('profile.importCurseforge') }}
          </v-tooltip>
        </v-btn>
      </v-speed-dial>
    </template>
    {{ $t('profile.importZip') }}
  </v-tooltip>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'

export default defineComponent({
  emits: ['import'],
})
</script>

<style>
</style>
