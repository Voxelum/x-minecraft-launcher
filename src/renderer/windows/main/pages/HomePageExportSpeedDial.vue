<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        open-on-hover
        style="position: absolute; left: 80px; bottom: 10px;  z-index: 1"
        direction="top"
        transition="slide-y-reverse-transition"
      >
        <template #activator>
          <v-btn
            flat
            icon
            dark
            :loading="refreshing"
            v-on="on"
            @click="$emit('show', 'normal')"
          >
            <v-icon dark>
              share
            </v-icon>
          </v-btn>
        </template>
        <v-btn
          flat
          icon
          dark
          :loading="refreshing"
          v-on="on"
          @click="$emit('show', 'curseforge')"
          @mouseenter="enter"
          @mouseleave="leave"
        >
          <v-icon
            :size="12"
            dark
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
import { defineComponent, reactive, toRefs } from '@vue/composition-api'
import { useI18n } from '/@/hooks'

export default defineComponent({
  props: {
    refreshing: Boolean,
  },
  setup() {
    const { $t } = useI18n()
    const data = reactive({ text: $t('profile.modpack.export') })
    const enter = () => { setTimeout(() => { data.text = $t('profile.modpack.exportCurseforge') }, 100) }
    const leave = () => { setTimeout(() => { data.text = $t('profile.modpack.export') }, 100) }
    return {
      ...toRefs(data),
      enter,
      leave,
    }
  },
})
</script>
