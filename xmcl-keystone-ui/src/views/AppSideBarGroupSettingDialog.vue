<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import { InstanceGroupData } from '@/composables/instanceGroup'

const name = ref('')
const color = ref('')
let data: InstanceGroupData | undefined
const { isShown } = useDialog<InstanceGroupData>('folder-setting', (folderData) => {
  data = folderData
  name.value = folderData.name
  color.value = folderData.color
})
const onSave = () => {
  if (data) {
    data.name = name.value
    data.color = color.value
  }
  isShown.value = false
}
const { t } = useI18n()
</script>

<template>
  <v-dialog
    v-model="isShown"
    width="500"
  >
    <v-card
      class="flex flex-col overflow-auto max-h-[90vh]"
    >
      <v-card-title>
        {{ t('instances.folderSetting') }}
      </v-card-title>
      <v-card-text class="overflow-auto">
        <v-text-field
          v-model="name"
          :label="t('name')"
        />
        <v-subheader class="px-0">
          {{ t('color') }}
        </v-subheader>
        <v-color-picker
          v-model="color"
          dot-size="25"
          mode="rgba"
          show-swatches
          swatches-max-height="200"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          text
          @click="isShown = false"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          @click="onSave"
        >
          <v-icon left>
            save
          </v-icon>
          {{ t('modified.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
