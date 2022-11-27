<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        open-on-hover
        style="z-index: 1;"
        direction="bottom"
        transition="slide-y-reverse-transition"
      >
        <template #activator>
          <v-btn
            text
            fab
            small
            @click="showAddInstanceDialog()"
            v-on="on"
          >
            <v-icon
              style="font-size: 28px; transition: all 0.2s ease;"
            >
              add
            </v-icon>
          </v-btn>
        </template>
        <v-btn
          style="z-index: 20;"
          fab
          small
          @click="showAddServerDialog()"
        >
          <v-tooltip
            :close-delay="0"
            left
          >
            <template #activator="{ on: tooltip }">
              <v-icon
                v-on="tooltip"
              >
                storage
              </v-icon>
            </template>
            {{ $t('instance.addServer') }}
          </v-tooltip>
        </v-btn>
      </v-speed-dial>
    </template>
    {{ $t('instances.add') }}
  </v-tooltip>
</template>

<script lang=ts setup>
import { useDialog } from '../composables/dialog'

const { show: showAddInstanceDialog } = useDialog('add-instance-dialog')
const { show: showAddServerDialog } = useDialog('add-server-dialog')

const { t } = useI18n()

</script>

<style>
</style>
