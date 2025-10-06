<template>
  <div class="px-1">
    <v-subheader class="flex items-center">
      {{ t('save.properties') }}
      <v-spacer />
      <v-btn
        v-if="!isUnlocked"
        icon
        small
        @click="unlock"
      >
        <v-icon small>lock</v-icon>
      </v-btn>
      <v-btn
        v-else
        icon
        small
        color="primary"
        :loading="saving"
        @click="save"
      >
        <v-icon small>save</v-icon>
      </v-btn>
    </v-subheader>
    
    <div class="grid grid-cols-1 gap-1 gap-y-3 overflow-auto overflow-y-hidden pr-2">
      <div class="item">
        <v-icon>badge</v-icon>
        <div class="overflow-x-auto overflow-y-hidden">
          <span>{{ t('save.levelName') }}</span>
          <v-text-field
            v-if="isUnlocked"
            v-model="editedLevelName"
            dense
            hide-details
            outlined
            class="mt-1"
          />
          <AppCopyChip
            v-else
            :value="saveFile.levelName"
            outlined
          />
        </div>
      </div>
      
      <div class="item">
        <v-icon>apps</v-icon>
        <div class="overflow-x-auto overflow-y-hidden">
          <span>{{ t('save.seed') }}</span>
          <v-text-field
            v-if="isUnlocked"
            v-model="editedSeed"
            dense
            hide-details
            outlined
            class="mt-1"
          />
          <AppCopyChip
            v-else
            :value="saveFile.seed"
            outlined
          />
        </div>
      </div>
      
      <div class="item">
        <v-icon>shield</v-icon>
        <div class="overflow-x-auto overflow-y-hidden">
          <span>{{ t('save.difficulty') }}</span>
          <v-select
            v-if="isUnlocked"
            v-model="editedDifficulty"
            :items="difficultyOptions"
            dense
            hide-details
            outlined
            class="mt-1"
          />
          <AppCopyChip
            v-else
            :value="getDifficultyName(saveFile.difficulty)"
            outlined
          />
        </div>
      </div>
      
      <div class="item">
        <v-icon>mode</v-icon>
        <div class="overflow-x-auto overflow-y-hidden">
          <span>{{ t('save.allowCheats') }}</span>
          <v-switch
            v-if="isUnlocked"
            v-model="editedCheat"
            dense
            hide-details
            class="mt-1"
          />
          <AppCopyChip
            v-else
            :value="saveFile.cheat ? t('yes') : t('no')"
            outlined
          />
        </div>
      </div>
      
      <div class="item">
        <v-icon>shop</v-icon>
        <div class="overflow-x-auto overflow-y-hidden">
          <span>{{ t('save.gameMode') }}</span>
          <AppCopyChip
            :value="getLevelMode(saveFile.mode)"
            outlined
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { useService } from '@/composables'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import AppCopyChip from './AppCopyChip.vue'
import { injection } from '@/util/inject';

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
    case 0: return t('difficulty.peaceful')
    case 1: return t('difficulty.easy')
    case 2: return t('difficulty.normal')
    case 3: return t('difficulty.hard')
    default: return 'Unknown'
  }
}

const getLevelMode = (mode: number) => {
  switch (mode) {
    case 0: return t('gameType.survival')
    case 1: return t('gameType.creative')
    case 2: return t('gameType.adventure')
    case 3: return t('gameType.spectator')
    case -1:
    default:
      return 'Non'
  }
}

// Initialize values from props
watch(() => props.saveFile, (newSave) => {
  if (newSave) {
    editedLevelName.value = newSave.levelName
    editedSeed.value = newSave.seed
    editedDifficulty.value = newSave.difficulty
    editedCheat.value = newSave.cheat
  }
}, { immediate: true })

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
.item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.item > .v-icon {
  margin-top: 0.25rem;
}

.item > div {
  flex: 1;
  min-width: 0;
}

.item span {
  display: block;
  font-weight: 500;
  margin-bottom: 0.25rem;
}
</style>
