<template>
  <div>
    <!-- Appearance Settings Card -->
    <v-card class="mb-6 mt-4" elevation="0" color="transparent" flat>
      <v-card-title class="text-h6 pb-2 px-0">
        <v-icon left color="primary">palette</v-icon>
        {{ t("setting.appearance") }}
      </v-card-title>
      <v-card-subtitle class="px-0 pb-3">
        {{ t("setting.appearanceDescription") || "Персонализируйте внешний вид лаунчера" }}
      </v-card-subtitle>
      
      <v-card-text class="px-0">
        <!-- Layout Selection Card -->
        <v-card class="settings-card mb-4" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-3">
              <v-icon color="primary" class="mr-2">view_quilt</v-icon>
              <div>
                <div class="font-weight-medium">{{ t('setting.layoutTitle') || 'Макет интерфейса' }}</div>
                <div class="text-caption text--secondary">{{ t('setting.layoutDescription') || 'Выберите стиль отображения' }}</div>
              </div>
            </div>
            <v-chip-group v-model="layout" active-class="primary--text" mandatory>
              <v-chip v-for="item in layouts" :key="item.value" :value="item.value" filter outlined class="mr-2">
                <v-icon left small>{{ item.value === 'focus' ? 'fullscreen' : 'dashboard' }}</v-icon>
                {{ item.text }}
              </v-chip>
            </v-chip-group>
          </v-card-text>
        </v-card>

        <!-- Linux Titlebar (Linux only) -->
        <v-card v-if="env?.os === 'linux'" class="settings-card mb-4" elevation="2">
          <v-card-text class="pa-4">
            <v-list-item class="px-0">
              <v-list-item-content>
                <v-list-item-title class="font-weight-medium">
                  <v-icon left small color="primary">window</v-icon>
                  {{ t('setting.linuxTitlebar') }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ t('setting.linuxTitlebarDescription') }}
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-switch v-model="linuxTitlebar" color="primary" hide-details />
              </v-list-item-action>
            </v-list-item>
          </v-card-text>
        </v-card>

        <!-- Theme Settings Card -->
        <v-card class="settings-card" elevation="2">
          <v-card-title class="pb-2">
            <v-icon left color="primary">style</v-icon>
            {{ t('setting.themeSettings') || 'Настройки темы' }}
          </v-card-title>
          <v-card-text>
            <AppearanceItems :theme="currentTheme" @save="onSave" />
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
import AppearanceItems from '@/components/AppearanceItems.vue'
import { kTheme } from '@/composables/theme'
import { kUIDefaultLayout } from '@/composables/uiLayout'
import { kEnvironment } from '@/composables/environment'
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'

const { t } = useI18n()
const env = injection(kEnvironment)
const { currentTheme, update, setTheme, serialize } = injection(kTheme)
const layout = injection(kUIDefaultLayout)
const { state } = injection(kSettingsState)

const layouts = computed(() => [{
  text: t('setting.layout.default'),
  value: 'default',
}, {
  text: t('setting.layout.focus'),
  value: 'focus',
}])

const linuxTitlebar = computed({
  get: () => state.value?.linuxTitlebar ?? false,
  set: (v) => state.value?.linuxTitlebarSet(v),
})

function onSave() {
  setTheme(currentTheme.value.name, serialize(currentTheme.value)).then(() => {
    update()
  })
}
</script>

<style scoped>
.settings-card {
  border-radius: 12px;
  transition: all 0.2s ease;
}

.settings-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

:deep(.transparent-list) {
  background: transparent !important;
}
</style>
