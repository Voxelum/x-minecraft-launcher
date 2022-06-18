<template>
  <v-dialog
    v-if="active"
    v-model="active"
    @dragover.prevent
  >
    <div
      style="display: flex"
      class="h-[80vh] w-full"
      @dragover.prevent
    >
      <v-fade-transition>
        <v-card
          class="w-full h-full items-center justify-center flex"
          :elevation="14"
        >
          <div
            v-if="loading"
          >
            <refreshing-tile />
          </div>
          <div
            v-else-if="dragover"
            class="text-center select-none"
          >
            <v-icon
              :style="{ 'font-size': `${50}px` }"
              style="display: block"
            >
              save_alt
            </v-icon>
            <v-card-text
              class="headline font-weight-bold"
              style="font-size: 100px"
            >
              {{ $t("universalDrop.title") }}
            </v-card-text>

            <v-card-text class="font-weight-bold">
              <v-icon>$vuetify.icons.forge</v-icon>
              {{ $tc("mod.name", 0) }}
              <v-icon>$vuetify.icons.fabric</v-icon>
              Fabric
              {{ $tc("mod.name", 0) }}
              <v-icon>$vuetify.icons.zip</v-icon>
              {{ $tc("resourcepack.name", 0) }}
              <v-icon>$vuetify.icons.package</v-icon>
              {{ $tc("save.name", 0) }}
              <v-icon :size="16">
                $vuetify.icons.curseforge
              </v-icon>
              {{ $tc("modpack.name", 0) }}
            </v-card-text>
          </div>
          <preview-view
            v-else
            :previews="previews"
            @remove="remove"
            @cancel="cancel"
          />
        </v-card>
      </v-fade-transition>
    </div>
  </v-dialog>
</template>

<script lang=ts setup>
import PreviewView from './AppDropDialogPreview.vue'
import RefreshingTile from '/@/components/RefreshingTile.vue'
import { DropServiceInjectionKey } from '/@/composables/dropService'
import { injection } from '/@/util/inject'

const { active, loading, remove, cancel, previews, dragover } = injection(DropServiceInjectionKey)
</script>
