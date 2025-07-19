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
          class="flex h-full w-full items-center justify-center"
          :elevation="14"
        >
          <div
            v-if="dragover"
            class="select-none text-center"
          >
            <v-icon
              :style="{ 'font-size': `${50}px` }"
              style="display: block"
            >
              save_alt
            </v-icon>
            <v-card-text
              class="text-h5 font-weight-bold"
              style="font-size: 100px"
            >
              {{ t("universalDrop.title") }}
            </v-card-text>

            <v-card-text class="font-weight-bold">
              <v-icon>xmcl:forge</v-icon>
              {{ t("mod.name", 0) }}
              <v-icon>xmcl:fabric</v-icon>
              Fabric
              {{ t("mod.name", 0) }}
              <v-icon>xmcl:zip</v-icon>
              {{ t("resourcepack.name", 0) }}
              <v-icon>xmcl:package</v-icon>
              {{ t("save.name", 0) }}
              <v-icon :size="16">
                xmcl:curseforge
              </v-icon>
              {{ t("modpack.name", 0) }}
            </v-card-text>
          </div>
          <PreviewView
            v-else
            class="flex-grow"
            :previews="previews"
            @remove="remove"
            @cancel="cancel"
            @import="onImport"
          />
        </v-card>
      </v-fade-transition>
    </div>
  </v-dialog>
</template>

<script lang=ts setup>
import RefreshingTile from '@/components/RefreshingTile.vue'
import PreviewView from './AppDropDialogPreview.vue'
import { useAppDropHandler } from '@/composables/appDropHandler'

const { active, loading, remove, cancel, previews, dragover, onImport } = useAppDropHandler()

const { t } = useI18n()
</script>
