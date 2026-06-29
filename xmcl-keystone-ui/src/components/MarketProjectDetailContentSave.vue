<template>
  <div class="px-1">
    <v-list-subheader>
      <div class="flex items-center flex-nowrap w-full flex-grow gap-1">
        {{ t('save.properties') }}
        <v-spacer />
        <v-btn v-if="!isUnlocked" variant="text" icon size="x-small" @click="unlock">
          <v-icon size="x-small">edit</v-icon>
        </v-btn>
        <v-btn v-else variant="text" icon color="primary" size="x-small" :loading="saving" @click="save">
          <v-icon size="x-small">save</v-icon>
        </v-btn>
      </div>
    </v-list-subheader>

    <div class="flex flex-col gap-2">
      <div class="prop-row">
        <div class="prop-row__header">
          <v-icon size="x-small" class="prop-row__icon">badge</v-icon>
          <span class="prop-row__label">{{ t('save.levelName') }}</span>
        </div>
        <v-text-field
          v-if="isUnlocked"
          v-model="editedLevelName"
          density="compact"
          hide-details
          variant="outlined"
        />
        <AppCopyChip v-else :value="saveFile.levelName" outlined />
      </div>

      <div class="prop-row">
        <div class="prop-row__header">
          <v-icon size="x-small" class="prop-row__icon">apps</v-icon>
          <span class="prop-row__label">{{ t('save.seed') }}</span>
        </div>
        <v-text-field
          v-if="isUnlocked"
          v-model="editedSeed"
          density="compact"
          hide-details
          variant="outlined"
        />
        <AppCopyChip v-else :value="saveFile.seed" outlined />
      </div>

      <div class="prop-row">
        <div class="prop-row__header">
          <v-icon size="x-small" class="prop-row__icon">shield</v-icon>
          <span class="prop-row__label">{{ t('save.difficulty') }}</span>
        </div>
        <v-select
          v-if="isUnlocked"
          v-model="editedDifficulty"
          :items="difficultyOptions"
          item-title="text"
          density="compact"
          hide-details
          variant="outlined"
        />
        <AppCopyChip v-else :value="getDifficultyName(saveFile.difficulty)" outlined />
      </div>

      <div class="prop-row prop-row--inline">
        <div class="prop-row__header">
          <v-icon size="x-small" class="prop-row__icon">mode</v-icon>
          <span class="prop-row__label">{{ t('save.allowCheats') }}</span>
        </div>
        <v-switch
          v-if="isUnlocked"
          v-model="editedCheat"
          density="compact"
          hide-details
          color="primary"
          class="prop-row__switch"
        />
        <AppCopyChip v-else :value="saveFile.cheat ? t('shared.yes') : t('shared.no')" outlined />
      </div>

      <div class="prop-row prop-row--inline">
        <div class="prop-row__header">
          <v-icon size="x-small" class="prop-row__icon">shop</v-icon>
          <span class="prop-row__label">{{ t('save.gameMode') }}</span>
        </div>
        <AppCopyChip :value="getLevelMode(saveFile.mode)" outlined />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { useService } from '@/composables'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import AppCopyChip from './AppCopyChip.vue'
import { injection } from '@/util/inject'

const props = defineProps<{
  saveFile: InstanceSaveFile
}>()

const emit = defineEmits<{
  (event: 'saved'): void
}>()

const { t } = useI18n()
const isUnlocked = ref(false)
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

const getDifficultyName = (difficulty: number) => {
  switch (difficulty) {
    case 0:
      return t('difficulty.peaceful')
    case 1:
      return t('difficulty.easy')
    case 2:
      return t('difficulty.normal')
    case 3:
      return t('difficulty.hard')
    default:
      return 'Unknown'
  }
}

const getLevelMode = (mode: number) => {
  switch (mode) {
    case 0:
      return t('gameType.survival')
    case 1:
      return t('gameType.creative')
    case 2:
      return t('gameType.adventure')
    case 3:
      return t('gameType.spectator')
    case -1:
    default:
      return 'Non'
  }
}

// Initialize values from props
watch(
  () => props.saveFile,
  (newSave) => {
    if (newSave) {
      editedLevelName.value = newSave.levelName
      editedSeed.value = newSave.seed
      editedDifficulty.value = newSave.difficulty
      editedCheat.value = newSave.cheat
    }
  },
  { immediate: true },
)

const unlock = () => {
  isUnlocked.value = true
}

const { updateSave } = injection(kInstanceSave)

const save = async () => {
  saving.value = true
  try {
    await updateSave(props.saveFile, {
      levelName: editedLevelName.value,
      seed: editedSeed.value,
      difficulty: editedDifficulty.value,
      cheat: editedCheat.value,
    })

    // Lock again after saving
    isUnlocked.value = false
    emit('saved')
  } catch (error) {
    console.error('Failed to update save:', error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.prop-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background-color: rgba(var(--v-theme-on-surface), 0.03);
  min-width: 0;
}

.prop-row__header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.prop-row__icon {
  opacity: 0.6;
}

.prop-row__label {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

/* Rows whose value is short (switch / single chip) read better side-by-side. */
.prop-row--inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.prop-row__switch {
  flex: 0 0 auto;
  margin: 0;
}
</style>
