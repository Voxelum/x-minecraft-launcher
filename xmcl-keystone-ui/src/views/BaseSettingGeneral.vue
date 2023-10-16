<template>
  <v-list
    class="base-settings"
    two-line
    subheader
  >
    <v-subheader style="">
      {{ t("BaseSettingGeneral.title") }}
    </v-subheader>

    <v-list-item>
      <v-list-item-action class="self-center">
        <v-menu
          :close-on-content-click="false"
          :nudge-width="380"
          offset-x
        >
          <template #activator="{ on, attrs }">
            <v-avatar
              v-ripple
              size="40"
              v-bind="attrs"
              v-on="on"
            >
              <img
                v-if="data.icon"
                :src="data.icon"
              >
              <v-icon v-else>
                add
              </v-icon>
            </v-avatar>
          </template>

          <v-card>
            <v-list>
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>
                    {{ t('instance.icon') }}
                  </v-list-item-title>
                </v-list-item-content>
              </v-list-item>
            </v-list>

            <v-divider />

            <v-list>
              <v-list-item>
                <v-text-field
                  v-model="data.icon"
                  :label="t('instance.iconUrl')"
                  small
                  hide-details
                  outlined
                  filled
                  dense
                />
                <v-list-item-action>
                  <v-btn
                    icon
                    @click="pickIconFile"
                  >
                    <v-icon>
                      upload_file
                    </v-icon>
                  </v-btn>
                </v-list-item-action>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>
      </v-list-item-action>

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
          outlined
          filled
          dense
          :placeholder="`Minecraft ${data.runtime.minecraft}`"
        />
      </v-list-item-action>
    </v-list-item>

    <v-list-item>
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/minecraft'"
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
        <VersionMenu
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
              outlined
              filled
              dense
              append-icon="arrow_drop_down"
              persistent-hint
              hide-details
              :readonly="true"
              @click:append="on.click($event);"
              v-on="on"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>

    <v-list-item v-if="!data.runtime.labyMod">
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/neoForged'"
          width="40"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t('neoForgedVersion.name')
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <a
            target="browser"
            href="https://github.com/neoforged/NeoForge"
          >https://github.com/neoforged/NeoForge</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <VersionMenu
          :is-clearable="true"
          :items="neoForgedItems"
          :clear-text="t('neoForgedVersion.disable')"
          :refreshing="refreshingNeoForged"
          @select="onSelectNeoForged"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.neoForged"
              outlined
              filled
              dense
              append-icon="arrow_drop_down"
              :placeholder="t('neoForgedVersion.disable')"
              :empty-text="t('neoForgedVersion.empty', { version: data.runtime.minecraft })"
              hide-details
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              @click="refreshNeoForged()"
              v-on="on"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>

    <v-list-item v-if="!data.runtime.labyMod">
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/forge'"
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
          <a
            target="browser"
            href="https://github.com/MinecraftForge/MinecraftForge"
          >https://github.com/MinecraftForge/MinecraftForge</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <VersionMenu
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
              outlined
              filled
              dense
              append-icon="arrow_drop_down"
              :placeholder="t('forgeVersion.disable')"
              :empty-text="t('forgeVersion.empty', { version: data.runtime.minecraft })"
              hide-details
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              @click="refreshForge()"
              v-on="on"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>
    <v-list-item v-if="!data.runtime.labyMod">
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/fabric'"
          width="40"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Fabric</v-list-item-title>
        <v-list-item-subtitle>
          <a
            target="browser"
            href="https://fabricmc.net/"
          >https://fabricmc.net/</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <VersionMenu
          :is-clearable="true"
          :items="fabricItems"
          :clear-text="t('fabricVersion.disable')"
          :has-snapshot="true"
          :empty-text="t('fabricVersion.empty', { version: data.runtime.minecraft })"
          :snapshot.sync="showStableOnly"
          :snapshot-tooltip="t('fabricVersion.showSnapshot')"
          :refreshing="refreshingFabric"
          @select="onSelectFabric"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.fabricLoader"
              outlined
              filled
              dense
              :placeholder="t('fabricVersion.disable')"
              hide-details
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              v-on="on"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>
    <v-list-item v-if="!data.runtime.labyMod">
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/quilt'"
          style="width: 40px"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Quilt</v-list-item-title>
        <v-list-item-subtitle>
          <a
            target="browser"
            href="https://quiltmc.org/"
          >https://quiltmc.org/</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <VersionMenu
          :is-clearable="true"
          :items="quiltItems"
          :empty-text="t('quiltVersion.empty', { version: data.runtime.minecraft })"
          :clear-text="t('quiltVersion.disable')"
          :refreshing="refreshingQuilt"
          @select="onSelectQuilt"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.quiltLoader"
              outlined
              filled
              dense
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
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>

    <v-list-item v-if="!data.runtime.labyMod">
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/optifine'"
          width="40px"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Optifine</v-list-item-title>
        <v-list-item-subtitle>
          <a
            target="browser"
            href="https://www.optifine.net/home"
          >https://www.optifine.net/home</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <VersionMenu
          :is-clearable="true"
          :items="optifineItems"
          :clear-text="t('optifineVersion.disable')"
          :empty-text="t('optifineVersion.empty', { version: data.runtime.minecraft })"
          :refreshing="refreshingOptifine"
          @select="onSelectOptifine"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.optifine"
              outlined
              filled
              dense
              hide-details
              :placeholder="t('optifineVersion.disable')"
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              v-on="on"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>

    <v-list-item v-if="data.runtime.labyMod">
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/labyMod'"
          width="40px"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>LabyMod</v-list-item-title>
        <v-list-item-subtitle>
          <a
            target="browser"
            href="https://www.labymod.net"
          >https://www.labymod.net</a>
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <VersionMenu
          :is-clearable="true"
          :items="labyModItems"
          :clear-text="t('labyMod.disable')"
          :empty-text="t('labyMod.empty', { version: data.runtime.minecraft })"
          :refreshing="refreshingLabyMod"
          @select="onSelectLabyMod"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.runtime.labyMod"
              outlined
              filled
              dense
              hide-details
              :placeholder="t('labyMod.disable')"
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              @click="refershLabyMod()"
              v-on="on"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>

    <v-list-item>
      <v-list-item-action class="self-center">
        <img
          :src="'image://builtin/craftingTable'"
          width="40px"
        >
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>{{ t('localVersion.title', 1) }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ t('localVersion.hint') }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <VersionMenu
          :items="localItems"
          :empty-text="t('localVersion.empty')"
          @select="onSelectLocalVersion"
        >
          <template #default="{ on }">
            <v-text-field
              :value="data.version"
              outlined
              filled
              dense
              hide-details
              :placeholder="t('localVersion.auto')"
              append-icon="arrow_drop_down"
              persistent-hint
              :readonly="true"
              @click:append="on.click($event);"
              v-on="on"
            />
          </template>
        </VersionMenu>
      </v-list-item-action>
    </v-list-item>

    <v-list-item
      @click="fastLaunch = !fastLaunch"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="fastLaunch"
          hide-details
          @click.stop
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instanceSetting.fastLaunch") }}
          <BaseSettingGlobalLabel
            :global="isGlobalFastLaunch"
            @clear="resetFastLaunch"
          />
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instanceSetting.fastLaunchHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item
      @click="hideLauncher = !hideLauncher"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="hideLauncher"
          hide-details
          @click.stop
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("instanceSetting.hideLauncher")
          }}
          <BaseSettingGlobalLabel
            :global="isGlobalHideLauncher"
            @clear="resetHideLauncher"
          />
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item
      @click="showLog = !showLog"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="showLog"
          hide-details
          @click.stop
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instanceSetting.showLog") }}
          <BaseSettingGlobalLabel
            :global="isGlobalShowLog"
            @clear="resetShowLog"
          />
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instanceSetting.showLogHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import VersionMenu from '../components/VersionMenu.vue'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { useFabricVersionList, useForgeVersionList, useLabyModVersionList, useMinecraftVersionList, useNeoForgedVersionList, useOptifineVersionList, useQuiltVersionList, VersionMenuItem } from '../composables/versionList'

import { injection } from '@/util/inject'
import BaseSettingGlobalLabel from './BaseSettingGlobalLabel.vue'
import { kLocalVersions } from '@/composables/versionLocal'

const {
  data,
  isGlobalFastLaunch,
  fastLaunch,
  resetFastLaunch,
  isGlobalHideLauncher,
  hideLauncher,
  resetHideLauncher,
  isGlobalShowLog,
  showLog,
  resetShowLog,
} = injection(InstanceEditInjectionKey)
const minecraft = computed(() => data.runtime.minecraft)
const { showOpenDialog } = windowController
const { versions } = injection(kLocalVersions)
const { items: minecraftItems, showAlpha, refreshing: refreshingMinecraft, release } = useMinecraftVersionList(minecraft, versions)
const { items: forgeItems, canShowBuggy, recommendedOnly, refresh: refreshForge, refreshing: refreshingForge } = useForgeVersionList(minecraft, computed(() => data.runtime.forge ?? ''), versions)
const { items: neoForgedItems, refresh: refreshNeoForged, refreshing: refreshingNeoForged } = useNeoForgedVersionList(minecraft, computed(() => data.runtime.neoForged ?? ''), versions)
const { items: fabricItems, showStableOnly, refreshing: refreshingFabric } = useFabricVersionList(minecraft, computed(() => data.runtime.fabricLoader ?? ''), versions)
const { items: quiltItems, refresh: refreshQuilt, refreshing: refreshingQuilt } = useQuiltVersionList(minecraft, computed(() => data.runtime.quiltLoader ?? ''), versions)
const { items: optifineItems, refreshing: refreshingOptifine } = useOptifineVersionList(minecraft, computed(() => data.runtime.forge ?? ''), computed(() => data.runtime.optifine ?? ''), versions)
const { items: labyModItems, refreshing: refreshingLabyMod, refresh: refershLabyMod } = useLabyModVersionList(minecraft, computed(() => data.runtime.labyMod ?? ''), versions)
const localItems = computed(() => {
  return versions.value.map(ver => {
    const result: VersionMenuItem = {
      name: ver.id,
      tag: ver.minecraft,
    }
    return result
  })
})

function pickIconFile() {
  showOpenDialog({
    title: t('instanceSetting.icon'),
    filters: [
      {
        name: t('instanceSetting.icon'),
        extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'],
      },
    ],
    properties: ['openFile'],
  }).then((result) => {
    if (result.canceled) return
    const filePath = result.filePaths[0]
    if (filePath) {
      const url = new URL(`image:///${filePath}`)
      data.icon = `image:///${filePath}`
    }
  })
}

function onSelectMinecraft(version: string) {
  if (data?.runtime) {
    const runtime = data.runtime
    data.version = ''
    runtime.minecraft = version
    runtime.forge = ''
    runtime.neoForged = ''
    runtime.fabricLoader = ''
    runtime.optifine = ''
  }
}
function onSelectForge(version: string) {
  if (data?.runtime) {
    const runtime = data?.runtime
    runtime.forge = version
    if (version) {
      data.version = ''
      runtime.neoForged = ''
      runtime.fabricLoader = ''
      runtime.quiltLoader = ''
    }
  }
}
function onSelectNeoForged(version: string) {
  if (data?.runtime) {
    const runtime = data?.runtime
    runtime.neoForged = version
    if (version) {
      data.version = ''
      runtime.forge = ''
      runtime.fabricLoader = ''
      runtime.quiltLoader = ''
    }
  }
}
function onSelectFabric(version: string) {
  if (data?.runtime) {
    const runtime = data?.runtime
    if (version) {
      data.version = ''
      runtime.forge = ''
      runtime.neoForged = ''
      runtime.quiltLoader = ''
      runtime.optifine = ''
    }
    runtime.fabricLoader = version
  }
}
function onSelectQuilt(version: string) {
  if (data?.runtime) {
    const runtime = data?.runtime
    runtime.quiltLoader = version
    if (version) {
      data.version = ''
      runtime.neoForged = ''
      runtime.forge = runtime.fabricLoader = ''
      runtime.optifine = ''
    }
  }
}
function onSelectOptifine(version: string) {
  if (data.runtime) {
    const runtime = data.runtime
    runtime.optifine = version
    if (version) {
      data.version = ''
      runtime.quiltLoader = runtime.fabricLoader = ''
    }
  }
}
function onSelectLabyMod(version: string) {
  if (data.runtime) {
    const runtime = data.runtime
    runtime.labyMod = version
    if (version) {
      data.version = ''
    }
  }
}
function onSelectLocalVersion(version: string) {
  data.version = version
  const v = versions.value.find(ver => ver.id === version)!
  data.runtime.minecraft = v.minecraft
  data.runtime.forge = v.forge
  data.runtime.liteloader = v.liteloader
  data.runtime.fabricLoader = v.fabric
  data.runtime.neoForged = v.neoForged
  data.runtime.optifine = v.optifine
  data.runtime.quiltLoader = v.quilt
  data.runtime.labyMod = v.labyMod
}

const { t } = useI18n()

</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
