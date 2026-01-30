<template>
  <div class="">
    <v-list
      class="non-moveable w-full"
      color="transparent"
      three-line
      subheader
    >
      <v-list-item class="items-center justify-center">
        <v-list-item-content>
          <v-list-item-title>
            {{
              t("setting.darkTheme")
            }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{
              t("setting.darkThemeDescription")
            }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-select
            v-model="data.theme"
            filled
            style="max-width: 185px"
            hide-details
            :items="themes"
          />
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang=ts setup>
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'

defineProps<{ value: string }>()

const data = injection('setup' as any) as any
const { isDark } = injection(kTheme)

const themes = computed(() => [{
  text: t('setting.theme.dark'),
  value: 'dark',
}, {
  text: t('setting.theme.light'),
  value: 'light',
}, {
  text: t('setting.theme.system'),
  value: 'system',
}])

const emit = defineEmits(['input'])

const { t } = useI18n()
</script>
