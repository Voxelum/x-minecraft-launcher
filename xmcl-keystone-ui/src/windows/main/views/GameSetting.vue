<template>
  <v-container
    grid-list-xs
    fill-height
    style="overflow: auto;"
  >
    <v-layout
      row
      wrap
      justify-start
      align-content-start
    >
      <v-flex
        tag="h1"
        style="margin-bottom: 10px; padding: 6px; 8px;"
        class="white--text"
        xs12
      >
        <span class="headline">{{ $tc('gamesetting.name', 2) }}</span>
        <v-spacer />
        <v-btn
          icon
          @click="showInFolder"
        >
          <v-icon>folder</v-icon>
        </v-btn>
      </v-flex>
      <v-flex
        v-for="g in graphics"
        :key="g.name"
        d-flex
        xs6
        @click="triggerGraphic(g)"
      >
        <v-btn

          outlined
        >
          {{ $t(`gamesetting.${g.name}.name`) + ' : ' }}
          <transition
            name="scroll-y-transition"
            mode="out-in"
          >
            <span
              :key="g.val.toString()"
              style="padding-left: 5px"
            >{{ $t(`gamesetting.${g.name}.${g.val}`) }}</span>
          </transition>
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { Frame } from '@xmcl/gamesetting'
import { defineComponent, reactive, toRefs } from '@vue/composition-api'
import { useAutoSaveLoad } from '/@/composables'
import { useInstanceGameSetting } from '../composables/instance'

export default defineComponent({
  setup() {
    const { refreshing, refresh, commit, showInFolder, ...settings } = useInstanceGameSetting()
    const data = reactive({
      graphics: [
        { name: 'fancyGraphics', options: [true, false], val: true },
        { name: 'renderClouds', options: [true, 'fast', false], val: true },
        { name: 'ao', options: [0, 1, 2], val: 2 },
        { name: 'entityShadows', options: [true, false], val: true },
        { name: 'particles', options: [0, 1, 2], val: 2 },
        { name: 'mipmapLevels', options: [0, 1, 2, 3, 4], val: 2 },
        { name: 'useVbo', options: [true, false], val: true },
        { name: 'fboEnable', options: [true, false], val: true },
        { name: 'enableVsync', options: [true, false], val: true },
        { name: 'anaglyph3d', options: [true, false], val: false },
      ],
    })
    type Graphic = typeof data['graphics'][number]

    async function load() {
      refresh()
      const graphics = data.graphics
      for (const setting of graphics) {
        const ref = Reflect.get(settings, setting.name)
        if (ref) {
          setting.val = ref.value ?? setting.val
        }
      }
    }
    function save() {
      const result: Frame = {}
      for (const setting of data.graphics) {
        result[setting.name as keyof Frame] = setting.val as any
      }
      commit(result)
    }
    useAutoSaveLoad(save, load)
    return {
      ...toRefs(data),
      refreshing,
      showInFolder,
      triggerGraphic(g: Graphic) {
        const index = g.options.indexOf(g.val as never)
        const nextIndex = (index + 1) % g.options.length
        g.val = g.options[nextIndex] as any
      },
    }
  },
})
</script>
