<template>
  <v-dialog
    :model-value="modelValue"
    max-width="540"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="rounded-2xl p-6 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <div class="flex items-center gap-3">
          <v-avatar color="primary" rounded="xl" size="42" class="text-white">
            <v-icon size="24">tune</v-icon>
          </v-avatar>
          <div>
            <div class="text-lg font-bold">{{ t('modloader.manage') }}</div>
            <div class="text-xs opacity-60">{{ t('modloader.manageHint') }}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <v-btn
            variant="tonal"
            size="small"
            color="warning"
            class="rounded-xl font-semibold"
            prepend-icon="restore"
            @click="onReset"
          >
            {{ t('modloader.reset') }}
          </v-btn>
          <v-btn
            icon="close"
            variant="text"
            size="small"
            @click="$emit('update:modelValue', false)"
          />
        </div>
      </div>

      <!-- Loaders List (Built-in + Custom) -->
      <div class="max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar mb-4">
        <div
          v-for="loader in allLoaders"
          :key="loader.id"
          class="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors cursor-pointer select-none"
          @click="toggle(loader.id)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <img :src="loader.icon" width="32" height="32" class="flex-shrink-0 object-contain" />
            <div class="flex flex-col min-w-0">
              <span class="text-sm font-bold text-white truncate">{{ loader.name }}</span>
              <span v-if="!loader.builtin" class="text-xs opacity-50 truncate">{{ loader.apiUrl || 'Custom' }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2" @click.stop>
            <v-btn
              v-if="!loader.builtin"
              icon="delete"
              variant="text"
              color="error"
              size="small"
              @click="removeLoader(loader.id)"
            />
            <v-switch
              :model-value="isLoaderEnabled(loader.id)"
              color="primary"
              hide-details
              density="compact"
              inset
              @update:model-value="setLoaderEnabled(loader.id, !!$event)"
            />
          </div>
        </div>
      </div>

      <!-- Add Modloader from API -->
      <div class="pt-4 border-t border-white/10">
        <div class="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">
          {{ t('modloader.add') }}
        </div>
        <div class="flex items-center gap-2">
          <v-text-field
            v-model="apiUrl"
            :placeholder="t('modloader.apiUrlHint')"
            density="compact"
            variant="outlined"
            :hide-details="!errorMessage"
            class="flex-1"
            :loading="loading"
            :error-messages="errorMessage"
            @keydown.enter="onAdd"
          />
          <v-btn
            color="primary"
            variant="flat"
            class="rounded-xl px-4 font-semibold"
            :loading="loading"
            :disabled="!apiUrl.trim()"
            @click="onAdd"
          >
            {{ t('modloader.addBtn') }}
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModloadersCustom } from '@/composables/modloaderCustom'

defineProps<{
  modelValue: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const { t } = useI18n()

const {
  allLoaders,
  isLoaderEnabled,
  setLoaderEnabled,
  removeLoader,
  addLoaderFromApi,
  resetToDefaults,
} = useModloadersCustom()

const apiUrl = ref('')
const loading = ref(false)
const errorMessage = ref('')

function toggle(id: string) {
  setLoaderEnabled(id, !isLoaderEnabled(id))
}

async function onAdd() {
  if (!apiUrl.value.trim() || loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await addLoaderFromApi(apiUrl.value.trim())
    apiUrl.value = ''
  } catch (e: any) {
    errorMessage.value = e?.message || 'Error'
  } finally {
    loading.value = false
  }
}

function onReset() {
  resetToDefaults()
}
</script>
