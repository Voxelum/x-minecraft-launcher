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

      <v-list-item class="items-center justify-center">
        <v-list-item-content>
          <v-list-item-title>
            {{
              t("setting.layoutTitle")
            }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{
              t("setting.layoutDescription")
            }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-select
            v-model="layout"
            filled
            style="max-width: 185px"
            hide-details
            :items="layouts"
          />
        </v-list-item-action>
      </v-list-item>
    </v-list>
    <v-item-group
      v-model="layoutModel"
      mandatory
      class="mx-auto flex max-w-[90vw] items-center justify-center gap-4 p-2"
    >
      <v-item
        :key="0"
        v-slot="{ active, toggle }"
      >
        <v-card
          :elevation="active ? 8 : 0"
          @click="toggle"
        >
          <SetupLayoutPreview
            :dark="isDark"
            :type="'default'"
          />
        </v-card>
      </v-item>
      <v-item
        :key="1"
        v-slot="{ active, toggle }"
      >
        <v-card
          :elevation="active ? 8 : 0"
          @click="toggle"
        >
          <SetupLayoutPreview
            :dark="isDark"
            :type="'focus'"
          />
        </v-card>
      </v-item>
    </v-item-group>

    <div class="max-w-180 mx-auto mt-4 flex items-center justify-center">
      <span
        v-if="layoutModel === 0"
      >
        {{ t('setup.defaultLayoutDescription') }}
      </span>
      <span
        v-else
      >
        {{ t('setup.focusLayoutDescription') }}
      </span>
    </div>
  </div>
</template>
<script lang=ts setup>
import SetupLayoutPreview from '@/components/SetupLayoutPreview.vue'
import { kTheme } from '@/composables/theme'
import { kUILayout } from '@/composables/uiLayout'
import { injection } from '@/util/inject'

defineProps<{ value: string }>()

const data = injection('setup' as any) as any
const { isDark } = injection(kTheme)

const layoutModel = computed({
  get() { return layout.value === 'default' ? 0 : 1 },
  set(v) { if (v) { layout.value = 'focus' } else { layout.value = 'default' } },
})

const layout = injection(kUILayout)

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

const layouts = computed(() => [{
  text: t('setting.layout.default'),
  value: 'default',
}, {
  text: t('setting.layout.focus'),
  value: 'focus',
}])

const emit = defineEmits(['input'])

const { t } = useI18n()
</script>
