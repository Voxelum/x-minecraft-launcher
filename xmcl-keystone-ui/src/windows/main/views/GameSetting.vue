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
import { defineComponent, reactive, toRefs } from 'vue'
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
<i18n locale="zh-CN" lang="yaml">
anaglyph3d:
  'false': 关闭
  name: 3D效果
  'true': 启用
ao:
  '0': 关
  '1': 最少
  '2': 最多
  name: 平滑光照
cheat: 作弊模式
difficulty:
  easy: 简单
  hard: 困难
  non: 未知难度
  normal: 正常
  peaseful: 和平
enableVsync:
  'false': 关闭
  name: 垂直同步
  'true': 开启
entityShadows:
  'false': 关闭
  name: 实体阴影
  'true': 开启
fancyGraphics:
  'false': 快速
  name: 图像质量
  'true': 最高
fboEnable:
  'false': 关闭
  name: 使用FBO
  'true': 启用
gametype:
  '0': 生存模式
  '1': 创造模式
  '2': 冒险模式
  '3': 观察者模式
  adventure: 冒险模式
  creative: 创造模式
  non: 未知模式
  spectator: 观察者模式
  survival: 生存模式
hardcore: 极限模式
mipmapLevels:
  '0': '0'
  '1': '1'
  '2': '2'
  '3': '3'
  '4': '4'
  name: Mipmap等级
name: 游戏设置
particles:
  '0': 最多
  '1': 较少
  '2': 最少
  name: 粒子
renderClouds:
  'false': 关闭
  fast: 快速
  name: 云
  'true': 最佳
useVbo:
  'false': 关闭
  name: 使用VBO
  'true': 启用
</i18n>

<i18n locale="en" lang="yaml">
anaglyph3d:
  'false': Disabled
  name: 3D Effect
  'true': Enabled
ao:
  '0': 'Off'
  '1': Minimum
  '2': Maximum
  name: Smooth Lighting
cheat: Cheating
difficulty:
  easy: Easy
  hard: Hard
  non: Unknown difficulty
  normal: Normal
  peaseful: Peaseful
enableVsync:
  'false': Disabled
  name: Vsync
  'true': Enabled
entityShadows:
  'false': Disabled
  name: Entity Shadows
  'true': Enabled
fancyGraphics:
  'false': Fast
  name: Graphic
  'true': Fancy
fboEnable:
  'false': Disabled
  name: Use FBO
  'true': Enabled
gametype:
  '0': Survival Mode
  '1': Creative Mode
  '2': Adventure Mode
  '3': Spectator Mode
  adventure: Adventure Mode
  creative: Creative Mode
  non: Non mode
  spectator: Spectator Mode
  survival: Survival Mode
hardcore: Hardcore mode
mipmapLevels:
  '0': '0'
  '1': '1'
  '2': '2'
  '3': '3'
  '4': '4'
  name: Mipmap
name: Game Setting | Game Settings
particles:
  '0': Maximum
  '1': Decreased
  '2': Minimum
  name: Particle
renderClouds:
  'false': 'Off'
  fast: Fast
  name: Clouds
  'true': Fancy
useVbo:
  'false': Disabled
  name: Use VBO
  'true': Enabled
</i18n>

<i18n locale="ru" lang="yaml">
anaglyph3d:
  'false': Отключен
  name: 3D эффект
  'true': Включен
ao:
  '0': Выключено
  '1': Минимум
  '2': Максимум
  name: Мягкое освещение
cheat: Читерство
difficulty:
  easy: Лёгкая
  hard: Тяжёлая
  non: Неизвестная сложность
  normal: Нормальная
  peaseful: Мирная
enableVsync:
  'false': Отключена
  name: Верт. синхронизация
  'true': Включена
entityShadows:
  'false': Отключены
  name: Тени существ
  'true': Включены
fancyGraphics:
  'false': Быстро
  name: Графика
  'true': Красиво
fboEnable:
  'false': Отключено
  name: Использовать FBO
  'true': Включено
gametype:
  '0': Режим выживания
  '1': Творческий режим
  '2': Режим приключения
  '3': Режим зрителя
  adventure: Режим приключения
  creative: Творческий режим
  non: Нет режима
  spectator: Режим зрителя
  survival: Режим выживания
hardcore: Хардкорный режим
mipmapLevels:
  '0': '0'
  '1': '1'
  '2': '2'
  '3': '3'
  '4': '4'
  name: Mipmap
name: Настройка игры | Настройки игры
particles:
  '0': Максимум
  '1': Уменьшено
  '2': Минимум
  name: Частицы
renderClouds:
  'false': Выключены
  fast: Быстро
  name: Облака
  'true': Красиво
useVbo:
  'false': Отключено
  name: Использовать VBO
  'true': Включено
</i18n>
