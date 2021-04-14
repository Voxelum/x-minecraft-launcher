<template>
  <v-dialog
    :value="value"
    @input="$emit('input', $event)"
  >
    <v-card
      v-if="updateInfo"
      dark
      style="overflow: auto; max-height: 500px"
    >
      <v-card-title style="display: block;">
        <h1>
          <a href="https://github.com/voxelum/x-minecraft-launcher/releases">
            {{ updateInfo.releaseName }}
          </a>
        </h1>
        <v-layout>
          <v-flex>
            <span class="grey--text">
              {{ updateInfo.releaseDate }}
            </span>
          </v-flex>
          <v-spacer />
          <v-flex shrink>
            <v-chip
              small
              label
            >
              v{{ updateInfo.version }}
            </v-chip>
          </v-flex>
        </v-layout>
      </v-card-title>
      <v-divider />
      <v-card-text
        style="overflow: auto;"
        v-html="updateInfo.releaseNotes"
      />
      <v-card-actions>
        <v-btn
          v-if="updateStatus === 'pending'"
          block
          color="primary"
          flat
          :loading="downloadingUpdate"
          :disabled="downloadingUpdate"
          @click="downloadUpdate()"
        >
          <v-icon
            color="white"
            left
          >
            cloud_download
          </v-icon>
          {{ $t('setting.updateToThisVersion') }}
        </v-btn>
        <v-btn
          v-else
          block
          color="primary"
          @click="quitAndInstall()"
        >
          <v-icon
            color="white"
            left
          >
            refresh
          </v-icon>
          {{ $t('setting.installAndQuit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <v-card
      v-else
      hover
      dark
      style="width: 100%"
      to="https://github.com/voxelum/x-minecraft-launcher/releases"
      replace
    >
      <v-container fill-height>
        <v-layout
          fill-height
          justify-space-around
          align-center
        >
          <h3 v-if="!checkingUpdate">
            {{ $t('setting.noUpdateAvailable') }}
          </h3>
          <v-progress-circular
            v-else
            indeterminate
          />
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { useUpdateInfo } from '/@/hooks'

export default defineComponent({
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    return {
      ...useUpdateInfo(),
    }
  },
})
</script>

<style>
</style>
