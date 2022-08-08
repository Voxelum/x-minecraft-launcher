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
          :placeholder="`Minecraft ${data.runtime.minecraft}`"
        />
      </v-list-item-action>
    </v-list-item>

    <v-list-item>
      <v-list-item-action class="self-center">
        <img
          :src="minecraftPng"
          width="40"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t('minecraftVersion.name')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t('instance.versionHint')
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <version-menu
          :is-clearable="false"
          :items="minecraftItems"
          :has-snapshot="true"
          :snapshot.sync="showAlpha"
          :snapshot-tooltip="t('fabricVersion.showSnapshot')"
          :refreshing="refreshingMinecraft"
          @select="onSelectMinecraft"
        >
          <template #default="{ on }">
            <v-text-field
              v-model="data.runtime.minecraft"
              solo
              append-icon="arrow_drop_down"
              persistent-hint
              hide-details
              :readonly="true"
              @click:append="on.click($event);"
              @click="refreshMinecraft()"
              v-on="on"
            />
          </template>
        </version-menu>
      </v-list-item-action>
    </v-list-item>

    <v-list-item>
      <v-list-item-action class="self-center">
        <img
          :src="forgePng"
          width="40"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t('forgeVersion.name')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <a href="https://github.com/MinecraftForge/MinecraftForge">https://github.com/MinecraftForge/MinecraftForge</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <version-menu
          :is-clearable="true"
          :items="forgeItems"
          :clear-text="t('forgeVersion.disable')"
          :has-snapshot="true"
          :snapshot.sync="canShowBuggy"
          :snapshot-tooltip="t('fabricVersion.showSnapshot')"
          :refreshing="refreshingForge"
          @select="onSelectForge"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.forge"
              solo
              append-icon="arrow_drop_down"
              :placeholder="t('forgeVersion.disable')"
              hide-details
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              @click="refreshForge()"
              v-on="on"
            />
          </template>
        </version-menu>
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-action class="self-center">
        <img
          :src="fabricPng"
          width="40"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Fabric</v-list-item-title>
        <v-list-item-subtitle>
          <a href="https://fabricmc.net/">https://fabricmc.net/</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <version-menu
          :is-clearable="true"
          :items="fabricItems"
          :clear-text="t('fabricVersion.disable')"
          :has-snapshot="true"
          :snapshot.sync="showStableOnly"
          :snapshot-tooltip="t('fabricVersion.showSnapshot')"
          :refreshing="refreshingFabric"
          @select="onSelectFabric"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.fabricLoader"
              solo
              :placeholder="t('fabricVersion.disable')"
              hide-details
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              @click="refreshFabric()"
              v-on="on"
            />
          </template>
        </version-menu>
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-action class="self-center">
        <quilt-icon style="width: 40px" />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Quilt</v-list-item-title>
        <v-list-item-subtitle>
          <a href="https://quiltmc.org/">https://quiltmc.org/</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <version-menu
          :is-clearable="true"
          :items="quiltItems"
          :clear-text="t('quiltVersion.disable')"
          :refreshing="refreshingQuilt"
          @select="onSelectQuilt"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.quiltLoader"
              solo
              hide-details
              :placeholder="t('quiltVersion.disable')"
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              @click="refreshQuilt()"
              v-on="on"
            />
          </template>
        </version-menu>
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
import { useI18n } from '/@/composables'
import { useMinecraftVersionList, useForgeVersionList, useFabricVersionList, useQuiltVersionList } from '../composables/versionList'
import minecraftPng from '/@/assets/minecraft.png'
import VersionMenu from '../components/VersionMenu.vue'
import fabricPng from '/@/assets/fabric.png'
import forgePng from '/@/assets/forge.png'
import QuiltIcon from '/@/components/QuiltIcon.vue'

const { data } = injection(InstanceEditInjectionKey)
const minecraft = computed(() => data.runtime.minecraft)
const { items: minecraftItems, showAlpha, refresh: refreshMinecraft, refreshing: refreshingMinecraft, release } = useMinecraftVersionList(minecraft)
const { items: forgeItems, canShowBuggy, recommendedOnly, refresh: refreshForge, refreshing: refreshingForge } = useForgeVersionList(minecraft, computed(() => data.runtime.forge ?? ''))
const { items: fabricItems, showStableOnly, refresh: refreshFabric, refreshing: refreshingFabric } = useFabricVersionList(minecraft, computed(() => data.runtime.fabricLoader ?? ''))
const { items: quiltItems, refresh: refreshQuilt, refreshing: refreshingQuilt } = useQuiltVersionList(minecraft, computed(() => data.runtime.quiltLoader ?? ''))

function onSelectMinecraft(version: string) {
  if (data?.runtime) {
    const runtime = data.runtime
    runtime.minecraft = version
    runtime.forge = ''
    runtime.fabricLoader = ''
  }
}
function onSelectForge(version: string) {
  if (data?.runtime) {
    const runtime = data?.runtime
    runtime.forge = version
    if (version) {
      runtime.fabricLoader = ''
      runtime.quiltLoader = ''
    }
  }
}
function onSelectFabric(version: string) {
  if (data?.runtime) {
    const runtime = data?.runtime
    if (version) {
      runtime.forge = ''
      runtime.quiltLoader = ''
    }
    runtime.fabricLoader = version
  }
}
function onSelectQuilt(version: string) {
  if (data?.runtime) {
    const runtime = data?.runtime
    if (version) {
      runtime.forge = runtime.fabricLoader = ''
      runtime.quiltLoader = version
    }
  }
}

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
