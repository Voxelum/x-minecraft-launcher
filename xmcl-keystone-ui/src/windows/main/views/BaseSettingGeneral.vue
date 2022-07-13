<template>
  <v-list
    class="base-settings"
    two-line
    subheader
  >
    <v-subheader style="">
      {{ t("title") }}
    </v-subheader>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>{{ t("instance.name") }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instance.nameHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-text-field
          v-model="data.name"
          small
          hide-details
          solo
          :placeholder="`Minecraft ${version.minecraft}`"
        />
      </v-list-item-action>
    </v-list-item>
    <v-list-item
      push
      to="/version-setting"
    >
      <v-list-item-content>
        <v-list-item-title>{{ t("instance.version") }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instance.versionHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <!-- <v-layout > -->
      <v-list-item-action
        class="gap-3 justify-end items-baseline"
        style="display: flex; flex-grow: 1; flex-direction: row;"
      >
        <v-chip
          color="green"
          large
          outlined
          label
        >
          {{ version.minecraft }}
        </v-chip>
        <v-chip
          v-if="version.forge"
          color="orange"
          large
          outlined
          label
        >
          Forge {{ version.forge }}
        </v-chip>
        <v-chip
          v-if="version.fabricLoader"
          large
          outlined
          label
          color="yellow"
        >
          Fabric {{ version.fabricLoader }}
        </v-chip>
      </v-list-item-action>
      <v-list-item-action>
        <v-btn icon>
          <v-icon>arrow_right</v-icon>
        </v-btn>
      </v-list-item-action>
      <!-- </v-layout> -->
    </v-list-item>

    <v-list-item
      push
      to="/resource-pack-setting"
    >
      <v-list-item-action>
        <v-icon>palette</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ tc("resourcepack.name", 2) }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("resourcepackHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn icon>
          <v-icon>arrow_right</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>

    <v-list-item
      push
      to="/shader-pack-setting"
    >
      <v-list-item-action>
        <v-icon>gradient</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ tc("shaderPack.name", 2) }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("shaderPackHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn icon>
          <v-icon>arrow_right</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>

    <v-list-item
      push
      to="/mod-setting"
    >
      <v-list-item-action>
        <v-icon>extension</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ tc("mod.name", 2) }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("modHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn icon>
          <v-icon>arrow_right</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>

    <v-list-item
      push
      to="/save"
    >
      <v-list-item-action>
        <v-icon>map</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ tc("save.name", 2) }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("saveHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn icon>
          <v-icon>arrow_right</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>

    <v-list-item
      @click="data.fastLaunch = !data.fastLaunch"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="data.fastLaunch"
          hide-details
          @click="data.fastLaunch = !data.fastLaunch"
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("fastLaunch") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("fastLaunchHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item
      @click="data.hideLauncher = !data.hideLauncher"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="data.hideLauncher"
          hide-details
          @click="data.hideLauncher = !data.hideLauncher"
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("hideLauncher")
          }}
        </v-list-item-title>
        <!-- <v-list-item-subtitle>
          {{ t("hideLauncher") }}
        </v-list-item-subtitle> -->
      </v-list-item-content>
    </v-list-item>
    <v-list-item
      @click="data.showLog = !data.showLog"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="data.showLog"
          hide-details
          @click="data.showLog = !data.showLog"
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>{{ t("showLog") }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ t("showLogHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import { injection } from '/@/util/inject'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { RuntimeVersions } from '@xmcl/runtime-api'
import { useI18n } from '/@/composables'

defineProps<{ version: RuntimeVersions }>()
const { data } = injection(InstanceEditInjectionKey)

const { t, tc } = useI18n()

</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>

<i18n locale="en" lang="yaml">
title: General
showLog: Show Minecraft Log
showLogHint: This will popup a window to stream Minecraft log after game started
hideLauncher: Hide the launcher after launch
fastLaunch: Turbo Launch
fastLaunchHint: Ignore the user status and existed unfixed problems
shaderPackHint: Enable or disable shader packs to this launch profile
resourcepackHint: Enable or disable resource packs to this launch profile
modHint: Enable or disable the Mods of this launch profile
saveHint: View and modify the saves of this launch profile
</i18n>

<i18n locale="zh-CN" lang="yaml">
title: 常规设置
showLog: Minecraft 启动后显示日志
showLogHint: 游戏开启后将弹出一个显示 Minecraft 日志的窗口
hideLauncher: Minecraft 启动后隐藏启动器
fastLaunch: 快速启动
fastLaunchHint: 启动时跳过刷新用户和没有修复的问题
shaderPackHint: 调整此配置的光影包
resourcepackHint: 调整本启动配置使用的资源包
modHint: 调整此启动配置所使用的的 Mod
saveHint: 浏览或修改此配置的存档
</i18n>

<i18n locale="ru" lang="yaml">
title: Общие
showLog: Показать журнал Minecraft
showLogHint: После запуска игры появится всплывающее окно для стриминга лога Minecraft.
hideLauncher: Скрыть лаунчер после запуска
shaderPackHint: Включить или отключить пакеты шейдеров для данного профиля запуска
resourcepackHint: Включение или отключение текстур для этого профиля запуска
modHint: Включение или отключение модов этого профиля запуска
saveHint: Просмотр и изменение сохранений этого профиля запуска
</i18n>
