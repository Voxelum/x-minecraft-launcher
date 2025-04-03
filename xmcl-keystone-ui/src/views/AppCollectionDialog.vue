<template>
  <SimpleDialog :width="500" v-model="isShown" :title="t('modrinth.createCollection')" @confirm="confirm"
    confirm-icon="check" :confirm="t('yes')" color="primary">
    <v-divider />
    <v-form class="mt-4">
      <v-text-field small filled v-model="newCollection.name" :label="t('name')"
        :rules="rules" />
      <v-text-field small filled v-model="newCollection.description" :label="t('description')" />
    </v-form>
  </SimpleDialog>
</template>
<script setup lang="ts">
import SimpleDialog from '@/components/SimpleDialog.vue';
import { useDialog } from '@/composables/dialog';
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI';
import { injection } from '@/util/inject';

const { t } = useI18n()
const newCollection = reactive({
  name: '',
  description: '',
  icon: undefined,
  projectId: undefined,
})

const { isShown, hide } = useDialog('collection', (id) => { 
  newCollection.projectId = id
  newCollection.name = ''
  newCollection.description = ''
  newCollection.icon = undefined
})
const { createCollection } = injection(kModrinthAuthenticatedAPI)
const rules = computed(() => [(v: any) => !!v || t('instance.requireName')])

function confirm() {
  if (!newCollection.name) {
    return
  }
  createCollection(newCollection.name, newCollection.description, newCollection.projectId ? [newCollection.projectId] : []).then(() => {
    newCollection.name = ''
    newCollection.description = ''
    newCollection.icon = undefined
    hide()
  })
}


</script>