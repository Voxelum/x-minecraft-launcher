<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        open-on-hover
        style="z-index: 1"
        direction="bottom"
        transition="slide-y-reverse-transition"
      >
        <template #activator>
          <v-btn
            flat
            fab
            dark
            small
            style="margin-left: 5px; margin-top: 5px;"
            @click="$emit('import', 'normal')"
            v-on="on"
          >
            <v-icon
              dark
              style="font-size: 28px"
            >
              save_alt
            </v-icon>
          </v-btn>
        </template>
        <v-btn
          style="z-index: 20;"
          fab
          small
          v-on="on"
          @click="$emit('import', 'folder')"
          @mouseenter="onMouseEnter('profile.importFolder')"
          @mouseleave="onMouseLeave"
        >
          <v-icon>folder</v-icon>
        </v-btn>
        <v-btn
          style="z-index: 20;"
          fab
          small
          v-on="on"
          @mouseenter="onMouseEnter('profile.importCurseforge')"
          @mouseleave="onMouseLeave"
          @click="$emit('import', 'curseforge')"
        >
          <v-icon
            :size="12"
            style="padding-right: 2px;"
          >
            $vuetify.icons.curseforge
          </v-icon>
        </v-btn>
      </v-speed-dial>
    </template>
    {{ text }}
  </v-tooltip>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent } from '@vue/composition-api'
import { useI18n } from '/@/hooks'

export default defineComponent({
  setup() {
    const { $t } = useI18n()
    const data = reactive({
      text: $t('profile.importZip'),
    })
    return {
      ...toRefs(data),
      onMouseEnter(text: string) {
        setTimeout(() => {
          data.text = $t(text)
        }, 100)
      },
      onMouseLeave() {
        setTimeout(() => {
          data.text = $t('profile.importZip')
        }, 100)
      },
    }
  },
})
</script>

<style>
</style>
