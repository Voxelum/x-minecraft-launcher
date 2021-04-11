<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        open-on-hover
        style="z-index: 1;"
        direction="bottom"
        transition="slide-y-reverse-transition"
      >
        <template #activator>
          <v-btn
            flat
            fab
            dark
            small
            @click="$emit('create', 'instance')"
            v-on="on"
          >
            <transition
              name="scale-transition"
              mode="out-in"
            >
              <v-icon
                dark
                style="font-size: 28px; transition: all 0.2s ease;"
              >
                add
              </v-icon>
            </transition>
          </v-btn>
        </template>
        <v-btn
          style="z-index: 20;"
          fab
          small
          v-on="on"
          @mouseenter="onMouseEnter"
          @mouseleave="onMouseLeave"
          @click="$emit('create', 'server')"
        >
          <v-icon>storage</v-icon>
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
      text: $t('profile.add'),
    })
    return {
      ...toRefs(data),
      onMouseEnter() {
        setTimeout(() => {
          data.text = $t('profile.addServer')
        }, 100)
      },
      onMouseLeave() {
        setTimeout(() => {
          data.text = $t('profile.add')
        }, 100)
      },
    }
  },
})
</script>

<style>
</style>
