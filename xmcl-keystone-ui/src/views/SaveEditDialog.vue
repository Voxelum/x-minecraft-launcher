<template>
  <v-dialog
    :value="isShown"
    width="600"
    persistent
    @input="$emit('update:isShown', $event)"
  >
    <v-card>
      <v-card-title class="headline">
        {{ t('save.edit.title') }}
      </v-card-title>
      
      <v-card-text>
        <v-text-field
          v-model="editedLevelName"
          :label="t('save.levelName')"
          outlined
          dense
        />
        
        <v-text-field
          v-model="editedSeed"
          :label="t('save.seed')"
          outlined
          dense
          type="text"
        />
        
        <v-select
          v-model="editedDifficulty"
          :label="t('save.difficulty')"
          :items="difficultyOptions"
          outlined
          dense
        />
        
        <v-switch
          v-model="editedCheat"
          :label="t('save.allowCheats')"
        />
      </v-card-text>

      <v-divider />
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          text
          @click="cancel"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          text
          :loading="saving"
          @click="save"
        >
          {{ t('save.edit.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { InstanceSaveFile } from '@/composables/instanceSave'
import { useService } from '@/composables'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  isShown: boolean
  save: InstanceSaveFile | null
}>()

const emit = defineEmits<{
  (event: 'update:isShown', value: boolean): void
  (event: 'saved'): void
}>()

const { t } = useI18n()
const saving = ref(false)

const editedLevelName = ref('')
const editedSeed = ref('')
const editedDifficulty = ref(0)
const editedCheat = ref(false)

const difficultyOptions = computed(() => [
  { text: t('difficulty.peaceful'), value: 0 },
  { text: t('difficulty.easy'), value: 1 },
  { text: t('difficulty.normal'), value: 2 },
  { text: t('difficulty.hard'), value: 3 },
])

watch(() => props.save, (newSave) => {
  if (newSave) {
    editedLevelName.value = newSave.levelName
    editedSeed.value = newSave.seed
    editedDifficulty.value = newSave.difficulty
    editedCheat.value = newSave.cheat
  }
}, { immediate: true })

const cancel = () => {
  emit('update:isShown', false)
}

const { updateSave } = useService(InstanceSavesServiceKey)

const save = async () => {
  if (!props.save) return
  
  saving.value = true
  try {
    await updateSave({
      instancePath: props.save.instanceName,
      saveName: props.save.name,
      metadata: {
        levelName: editedLevelName.value,
        seed: editedSeed.value,
        difficulty: editedDifficulty.value,
        cheat: editedCheat.value,
      },
    })
    emit('saved')
    emit('update:isShown', false)
  } catch (error) {
    console.error('Failed to update save:', error)
  } finally {
    saving.value = false
  }
}
</script>
