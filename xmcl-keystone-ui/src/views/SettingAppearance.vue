<template>
  <div>
    <SettingHeader>🎨 {{ t("setting.appearance") }}</SettingHeader>
    <SettingItemSelect
      :select.sync="layout"
      :title="t('setting.layoutTitle')"
      :description="t('setting.layoutDescription')"
      :items="layouts"
    />
    <SettingItemCheckbox
      v-if="env?.os === 'linux'"
      :value="linuxTitlebar"
      :title="t('setting.linuxTitlebar')"
      :description="t('setting.linuxTitlebarDescription')"
      @input="v => linuxTitlebar = v"
    />
    <!-- <SettingItemCheckbox
      v-if="env?.os === 'windows' || env?.os === 'osx'"
      :value="windowTranslucent"
      :title="t('setting.windowTranslucent')"
      :description="t('setting.windowTranslucentDescription')"
      @input="v => windowTranslucent = v"
    /> -->
    <AppearanceItems :theme="currentTheme" @save="onSave" />
  </div>
</template>
<script lang="ts" setup>
import AppearanceItems from '@/components/AppearanceItems.vue'
import SettingHeader from '@/components/SettingHeader.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useService } from '@/composables'
import { kEnvironment } from '@/composables/environment'
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { kUIDefaultLayout } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { serialize } from '@/util/theme.v1'
import { ThemeServiceKey } from '@xmcl/runtime-api'

const { t } = useI18n()
const { state } = injection(kSettingsState)
const env = injection(kEnvironment)
const { currentTheme, update } = injection(kTheme)
const { setTheme } = useService(ThemeServiceKey)

const linuxTitlebar = computed({
  get: () => state.value?.linuxTitlebar ?? false,
  set: v => state.value?.linuxTitlebarSet(v),
})

// const windowTranslucent = computed({
//   get: () => state.value?.windowTranslucent ?? false,
//   set: v => state.value?.windowTranslucentSet(v),
// })

// watch(windowTranslucent, (newVal) => {
//   windowController.setTranslucent(newVal)
// }, { immediate: true })

const layout = injection(kUIDefaultLayout)

const layouts = computed(() => [{
  text: t('setting.layout.default'),
  value: 'default',
}, {
  text: t('setting.layout.focus'),
  value: 'focus',
}])


function onSave() {
  setTheme(currentTheme.value.name, serialize(currentTheme.value)).then(() => {
    update()
  })
}

</script>
