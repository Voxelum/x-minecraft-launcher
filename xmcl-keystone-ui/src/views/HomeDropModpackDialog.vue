<template>
  <SimpleDialog
    :title="t('modpackImportConfirm.title')"
    :width="500"
    :persistent="true"
    v-model="isShown"
    @confirm="onConfirm"
    @cancel="isShown = false"
    :confirm="t('yes')"
    :confirm-icon="'check'"
    color="primary"
  >
    {{ t('modpackImportConfirm.description') }}
    <div class="select-text mt-4 p-2 px-4 dark:bg-[rgba(0,0,0,0.4)] light:bg-[rgba(255,255,255,0.1)] rounded">
      {{ target }}
    </div>
  </SimpleDialog>
</template>
<script setup lang="ts">
import SimpleDialog from '@/components/SimpleDialog.vue';
import { useDialog } from '@/composables/dialog';
import { AddInstanceDialogKey } from '@/composables/instanceTemplates';

const { t } = useI18n()
const target = ref('')
const { show } = useDialog(AddInstanceDialogKey)
const { isShown } = useDialog('HomeDropModpackDialog', (v) => {
  target.value = v
}, () => {
  target.value = ''
})

function onConfirm() {
  show({
    format: 'modpack',
    path: target.value,
  })
}
</script>