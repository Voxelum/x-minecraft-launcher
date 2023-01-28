<template>
  <v-treeview
    class="export-dialog-files"
    :value="value"
    style="width: 100%"
    :search="search"
    :items="files"
    :open="opened"
    :selectable="selectable"
    open-on-click
    item-children="children"
    @input="$emit('input', $event)"
  >
    <template #prepend="{ item, open, selected }">
      <v-icon
        v-if="item.children"
        :color="selected ? 'accent' : ''"
      >
        {{ open ? 'folder_open' : 'folder' }}
      </v-icon>
      <v-icon v-else>
        {{ getIcon(item.id) }}
      </v-icon>
    </template>

    <template #append="{ item, selected }">
      <div class="flex gap-1">
        <slot
          :item="item"
          :selected="selected"
        />
      </div>
    </template>

    <template #label="{ item }">
      <div style="padding: 5px 0px;">
        <span
          style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
          :style="{ color: item.disabled ? 'grey' : darkTheme ? 'white' : 'black', ...(item.style || {}) }"
        >{{ item.name }}</span>
        <div
          style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
        >
          {{ getDescription(item) }}
        </div>
        <div
          v-if="item.size > 0"
          style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
        >
          {{ item.size > 0 ? getExpectedSize(item.size) : '' }}
        </div>
      </div>
    </template>
  </v-treeview>
</template>

<script lang=ts setup>
import { FileNodesSymbol, InstanceFileNode } from '../composables/instanceFiles'
import { useTheme } from '@/composables'

import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'

defineProps<{
  value: string[]
  multiple?: boolean
  selectable?: boolean
  search?: string
}>()

const { t } = useI18n()
const { darkTheme } = useTheme()

const opened = ref([])

const files = injection(FileNodesSymbol)

function getIcon(file: string) {
  if (file.endsWith('.jar') || file.endsWith('.zip')) {
    return '$vuetify.icons.package'
  }
  return 'insert_drive_file'
}
const translatedFiles = computed(() => ({
  mods: t('intro.struct.mods'),
  resourcepacks: t('intro.struct.resourcepacks'),
  config: t('intro.struct.config'),
  saves: t('intro.struct.saves'),
  'options.txt': t('intro.struct.optionTxt'),
  logs: t('intro.struct.logs'),
  'optionsshaders.txt': t('intro.struct.optionShadersTxt'),
} as Record<string, string>))
const translatedMods = computed(() => ({
  curseforge: t('exportModpackTarget.curseforge'),
  modrinth: t('exportModpackTarget.modrinth'),
  override: t('exportModpackTarget.override'),
}))

function getDescription(item: InstanceFileNode<any>) {
  if (item.id in translatedFiles.value) {
    return translatedFiles.value[item.id]
  }
  if (item.id.startsWith('mods/')) {
    let text = t('intro.struct.modJar')
    if (item.data) {
      if (item.data.curseforge) {
        text += (' 🧬 ' + translatedMods.value.curseforge)
      }
      if (item.data.modrinth) {
        text += (' 🧬 ' + translatedMods.value.modrinth)
      }
      if (!item.data.modrinth && !item.data.curseforge) {
        text += (' 🧬 ' + translatedMods.value.override)
      }
    }
    return text
  }
  return ''
}
watch(files, () => {
  opened.value = []
})
</script>

<style>
.export-dialog-files
  .v-text-field>.v-input__control>.v-input__slot:before {
  border: none;
}
</style>

<i18n locale="en" lang="yaml">
intro:
  struct:
    assets: Same with vanilla. The assets folder cache the game assets
    config: The instance config folder
    forge-versions: The global cache of Forge version metadata
    java: The global cache of found java
    jre: Cache the launcher downloaded JRE (JVM 8)
    libraries: Same with vanilla.
    lite-versions: The global cache of Liteloader version metadata
    logs: Containing launched game logs
    mclogs: The normal Minecraft game logs
    modJar: The mod jar file
    modLite: The mod lite loader file
    modManaged: The managed mod jar file
    mods: Mods folder. Containing all the enabled mods of this modpack
    optionShadersTxt: Optifine shader setting file
    optionTxt: Minecraft Vanilla game setting file
    options: The normal Minecraft game settings
    profile: The JSON store launch profile config
    profileFolder: The folder contains a specific launch profile. The name is the uuid
    profiles: The folder contains each launch profile
    resourceJson: The resource metadata matching one mod or resourcepack
    resourcepack: The normal resource pack zip
    resourcepacks: ResourcePack folder. Containing all the resource pack of this modpack
    resources: The folder contains the managed mods/resourcepacks metadata
    root: The root the your minecraft data folder
    saves: Minecraft Saves
    temp: The temp folder (for download) the Launcher have
    user: The user auth info cache
    version: The global cache of Minecraft version metadata
    versions: Same with vanilla. Save multiple versions' JSON & JAR
</i18n>

<i18n locale="zh-CN" lang="yaml">
intro:
  struct:
    assets: 和原版一样，保存游戏贴图/声音等
    config: 模组配置文件夹
    forge-versions: Forge 版本信息缓存
    java: 已发现 Java 的位置版本等信息
    jre: 缓存启动器下载的 JRE
    libraries: 和原版一样
    lite-versions: Liteloader 版本信息缓存
    logs: 已经启动的游戏的日志文件夹
    mclogs: 此启动配置下的 Minecraft 的游戏日志
    modJar: 一个正常的 Mod Jar 文件
    modLite: 一个正常的 Liteloader Mod 文件
    modManaged: Curseforge 的 Mod Jar 文件
    mods: Mods 文件夹，含有此整合包启用的所有 Mod
    optionShadersTxt: Optifine 光影设置文件
    optionTxt: Minecraft 原版游戏设置文件
    options: 常规的 Minecraft 游戏设置文件
    profile: 储存启动配置的具体 JSON 文件
    profileFolder: 某一个具体的启动配置文件夹，名称是其 UUID
    profiles: 保存负责版本分离的启动配置
    resourceJson: 某一个 Mod 或资源包的元数据
    resourcepack: 一个正常的资源包压缩文件
    resourcepacks: 资源包文件夹，含有此整合包启用的所有资源包
    resources: 保存已发现的 Mods/资源包的元数据
    root: Minecraft 的数据目录
    saves: Minecraft 地图文件夹
    temp: 启动器临时文件夹，一般用来放下载文件
    user: 用户验证信息缓存
    version: Minecraft 版本信息缓存
    versions: 和原版一样，保存各个版本的 JAR 和 JSON
</i18n>

<i18n locale="ru" lang="yaml">
intro:
  struct:
    assets: Как с Vanilla. Папка assets кэширует игровые активы
    config: Папка конфигурации экземпляра
    forge-versions: Глобальный кэш метаданных версии Forge
    java: Глобальный кэш найденной версии java
    jre: Кеш скачаного JRE (JVM 8) лаунчера
    libraries: Как с Vanilla.
    lite-versions: Глобальный кэш метаданных версии Liteloader
    logs: Содержит логи запущенных игр
    mclogs: Обычные игровые логи Minecraft
    modJar: Jar-файл мода
    modLite: Файл мода liteloader
    modManaged: Jar-файл мода curseforge
    mods: Папка модов. Содержит все включенные моды этого модпака
    optionShadersTxt: Файл настроек шейдера Optifine
    optionTxt: Файл настроек игры Minecraft Vanilla
    options: Обычные игровые настройки Minecraft
    profile: Конфигурация профиля запуска JSON store
    profileFolder: Папка содержит определенный профиль запуска. Имя - это идентификатор UUID
    profiles: Папка содержит каждый профиль запуска
    resourceJson: Метаданные ресурса соответствуют одному моду или пакету текстур
    resourcepack: Обычный zip пакета текстур
    resourcepacks: Папка ResourcePack. Содержит все пакеты тектсур этого модпака
    resources: Папка содержит метаданные управляемых модов/пакетов текстур.
    root: Корневой каталог вашей папки данных minecraft
    saves: Сохранения Minecraft
    temp: У лаунчера есть временная папка (для скачивания)
    user: Кэш информация об авторизации пользователя
    version: Глобальный кеш метаданных версии Minecraft
    versions: Как с Vanilla. Сохранение нескольких версий JSON и JAR
</i18n>
