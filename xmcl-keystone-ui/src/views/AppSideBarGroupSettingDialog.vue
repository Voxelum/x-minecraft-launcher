<script setup lang="ts">
import { useDialog } from '@/composables/dialog'

const props = defineProps<{
  defaultColor: string
}>()

const name = ref('')
const color = ref(props.defaultColor)
let data: {
  color: string
  name: string
} | undefined
const hasColor = ref(true)

const { isShown } = useDialog<{
  color: string
  name: string
  noColor?: boolean
}>('folder-setting', (folderData) => {
  data = folderData
  name.value = folderData.name
  color.value = folderData.color || props.defaultColor
  if (folderData.noColor) {
    hasColor.value = false
  } else {
    hasColor.value = true
  }
})
const onSave = () => {
  if (data) {
    data.name = name.value
    if (color.value !== props.defaultColor) {
      data.color = color.value
    }
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
      class="flex flex-col overflow-auto max-h-[90vh] visible-scroll"
    >
      <v-card-title>
        {{ t('instances.folderSetting') }}
      </v-card-title>
      <v-divider />
      <v-card-text class="overflow-auto pt-4">
        <v-text-field
          v-model="name"
          :label="t('name')"
          autofocus
        />
        <template v-if="hasColor">
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
        </template>
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
