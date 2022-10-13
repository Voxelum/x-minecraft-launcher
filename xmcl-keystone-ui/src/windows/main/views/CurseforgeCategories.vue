<template>
  <v-card
    v-if="!refreshing"
    outlined
    class="p-2 rounded-lg flex flex-col h-[fit-content] overflow-auto"
  >
    <span
      v-for="c of categories"
      :key="c.id"
      :class="{ selected: c.id === Number(selected) }"
      class="item"
      @click="emit('select', c.id)"
    >
      <v-avatar>
        <img
          contain
          :src="c.iconUrl"
        >
      </v-avatar>
      {{ t(c.name) }}
    </span>
  </v-card>
  <v-card
    v-else
    outlined
    class="p-2 rounded-lg flex flex-col h-[fit-content] overflow-auto"
  >
    <v-skeleton-loader
      class="flex flex-col gap-3 overflow-auto"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
  </v-card>
</template>
<script lang="ts" setup>
import { ModCategory } from '@xmcl/curseforge'
import { CurseForgeServiceKey } from '@xmcl/runtime-api'
import { useI18n, useService } from '/@/composables'
import { useRefreshable } from '/@/composables/refreshable'

const props = defineProps<{
  type: string
  selected: string
}>()

const emit = defineEmits(['select'])

const { t } = useI18n()
const { fetchCategories } = useService(CurseForgeServiceKey)
const allCategories = ref([] as ModCategory[])
const categories = computed(() => {
  const result = allCategories.value
  const parent = result.find(c => c.slug === props.type)
  console.log(parent)
  return result.filter(r => r.parentCategoryId === parent?.id)
})

const { refresh, refreshing } = useRefreshable(async () => {
  const result = await fetchCategories()
  allCategories.value = result
})
onMounted(() => {
  refresh()
})

</script>

<style scoped>
.item {
  @apply rounded-lg ml-2 hover:bg-[rgba(255,255,255,0.2)] cursor-pointer p-1 pl-3 flex items-center gap-2;
}

.list-title {
  @apply font-bold text-lg py-1;
}

.selected {
  @apply bg-[rgba(255,255,255,0.2)];
}

</style>

<i18n locale="zh-CN" lang="yaml">
Fabric: Fabric
Cosmetic: 外观/装饰
Vanilla+: 原版+
"Armor, Tools, and Weapons": 护甲，工具和武器
QoL: QoL
Map and Information: 地图和信息
Twitch Integration: Twitch 集成
Addons: 插件
Utility & QoL: 工具和 QoL
World Gen: 世界生成
Adventure and RPG: 冒险和 RPG
Magic: 魔法
API and Library: API 和库
Technology: 科技
Redstone: 红石
Server Utility: 服务端工具
Miscellaneous: 杂项
Food: 食物
Storage: 存储
MCreator: MCreator
FancyMenu: FancyMenu
Education: 教育
Medieval: 中世纪
'Photo Realistic': 真实风格
Animated: 动画
Steampunk: 蒸汽朋克
'Data Packs': 数据包
Modern: 现代
Traditional: 传统
'Font Packs': 字体
'Mod Support': Mod 集成
Multiplayer: 多人联机
'Mini Game': 小游戏
'Combat / PvP': 竞技/PVP
Exploration: 探索
'FTB Official Pack': FTB 官方包
'Small / Light': 轻量级
Skyblock: 空岛
Quests: 任务
Map Based: 基于地图
Tech: 科技
Sci-Fi: 科幻
'Extra Large': 超大型
Hardcore: 硬核
'Game Map': 游戏地图
Creation: 创造模式
Parkour: 跑酷
'Modded World': Mod 集成
Survival: 生存
Adventure: 冒险
Puzzle: 解密
</i18n>
