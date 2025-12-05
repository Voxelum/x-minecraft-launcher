<!-- src/components/SettingGlobalAdvanced.vue -->
<template>
  <div>
    <!-- Advanced / Dangerous Actions Card -->
    <v-card class="mb-4" elevation="2" color="transparent">
      <v-card-title class="text-subtitle-1 pb-2 error--text">
        <v-icon left color="error" small>warning</v-icon>
        {{ t('setting.advancedSettings') }}
      </v-card-title>
      <v-card-subtitle class="pb-0">
        {{ t('setting.advancedSettingsHint') }}
      </v-card-subtitle>
      <v-card-text class="pa-4">
        <v-list class="transparent-list">
          <!-- Reset All Settings -->
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium error--text">
                {{ t('setting.resetAllSettings') }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ t('setting.resetAllSettingsHint') }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn color="error" outlined small @click="showResetDialog = true">
                <v-icon left small>restore</v-icon>
                {{ t('setting.resetAllSettings') }}
              </v-btn>
            </v-list-item-action>
          </v-list-item>

          <v-divider class="my-2" />

          <!-- Export/Import Settings -->
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">
                {{ t('setting.exportSettings') }} / {{ t('setting.importSettings') }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ t('setting.exportSettingsHint') }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action class="flex-row gap-2">
              <v-btn color="primary" outlined small @click="handleExportSettings">
                <v-icon left small>file_download</v-icon>
                {{ t('setting.exportSettings') }}
              </v-btn>
              <v-btn color="primary" outlined small @click="handleImportSettings">
                <v-icon left small>file_upload</v-icon>
                {{ t('setting.importSettings') }}
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Reset Confirmation Dialog -->
    <v-dialog v-model="showResetDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="text-h5 error--text">
          <v-icon left color="error" large>warning</v-icon>
          {{ t('setting.resetAllSettingsConfirmTitle') }}
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-1">{{ t('setting.resetAllSettingsConfirmMessage') }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showResetDialog = false">
            {{ t('cancel') }}
          </v-btn>
          <v-btn color="error" @click="handleResetAllSettings" :loading="resetting">
            {{ t('yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'

const { t } = useI18n()
const { quit } = useService(BaseServiceKey)

// --- Advanced Settings State ---
const showResetDialog = ref(false)
const resetting = ref(false)

// --- Methods ---

/**
 * Handles the full reset of all application settings.
 * Clears localStorage, sessionStorage, and IndexedDB, then quits the app.
 */
async function handleResetAllSettings() {
  resetting.value = true
  try {
    localStorage.clear()
    sessionStorage.clear()
    try {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    } catch (e) {
      console.warn('Failed to clear IndexedDB:', e)
    }

    alert(t('setting.resetAllSettingsSuccess'))
    setTimeout(async () => {
      await quit()
    }, 1000)
  } catch (error) {
    console.error('Failed to reset settings:', error)
    alert('Ошибка при сбросе настроек: ' + error)
    resetting.value = false
    showResetDialog.value = false
  }
}

/**
 * Exports all settings from localStorage into a downloadable .xmclsettings file.
 */
async function handleExportSettings() {
  try {
    const allLocalStorage: Record<string, any> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        try {
          const value = localStorage.getItem(key)
          if (value) {
            try {
              allLocalStorage[key] = JSON.parse(value)
            } catch {
              allLocalStorage[key] = value
            }
          }
        } catch (e) {
          console.warn(`Failed to export key: ${key}`, e)
        }
      }
    }

    const settingsData = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      launcherVersion: '0.53.0',
      localStorage: allLocalStorage,
    }

    const json = JSON.stringify(settingsData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `xmcl-settings-${new Date().toISOString().split('T')[0]}.xmclsettings`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    alert(t('setting.settingsExported'))
  } catch (error) {
    console.error('Failed to export settings:', error)
    alert(t('setting.settingsImportError'))
  }
}

/**
 * Prompts the user to select a .xmclsettings file and imports the settings from it.
 */
async function handleImportSettings() {
  try {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xmclsettings'

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!data.version) {
          throw new Error('Invalid settings file format - missing version')
        }

        if (data.localStorage) {
          for (const [key, value] of Object.entries(data.localStorage)) {
            try {
              const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
              localStorage.setItem(key, stringValue)
            } catch (e) {
              console.warn(`Failed to import key: ${key}`, e)
            }
          }
        }

        alert(t('setting.settingsImported') + '\n\nЛаунчер перезагрузится для применения всех настроек.')

        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } catch (parseError) {
        console.error('Failed to parse settings file:', parseError)
        alert(t('setting.settingsImportError') + '\n\n' + parseError)
      }
    }

    input.click()
  } catch (error) {
    console.error('Failed to import settings:', error)
    alert(t('setting.settingsImportError'))
  }
}
</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-card {
  border-radius: 12px;
  transition: all 0.2s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
