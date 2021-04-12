<template>
  <v-container
    fill-height
    style="overflow: auto"
  >
    <v-layout
      wrap
      fill-height
    >
      <v-flex
        d-flex
        xs12
        tag="h2"
        class="white--text headline"
      >
        {{ $t("profile.setting") }}
        <!-- <span class="headline"></span> -->
      </v-flex>
      <v-flex
        d-flex
        xs12
      >
        <v-list
          class="base-settings"
          two-line
          subheader
        >
          <v-subheader style="padding-right: 2px">
            {{ $t("setting.general") }}
          </v-subheader>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t("profile.name") }}</v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("profile.nameHint") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-text-field
                v-model="name"
                small
                hide-details
                dark
                :placeholder="`Minecraft ${version.minecraft}`"
              />
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile
            class="selected-version"
            replace
            to="/version-setting"
          >
            <v-list-tile-content>
              <v-list-tile-title>{{ $t("profile.version") }}</v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("profile.versionHint") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <!-- <v-layout > -->
            <v-list-tile-action style="margin-right: 15px; display: flex; flex-grow: 1; flex-direction: row; align-item: center; justify-content: flex-end; align-items: center">
              <v-chip
                color="green"
                large
                outline
                label
              >
                {{ version.minecraft }}
              </v-chip>
              <v-chip
                v-if="version.forge"
                color="orange"
                large
                outline
                label
              >
                Forge {{ version.forge }}
              </v-chip>
              <v-chip
                v-if="version.fabricLoader"
                large
                outline
                label
                color="yellow"
              >
                Fabric {{ version.fabricLoader }}
              </v-chip>
            </v-list-tile-action>
            <v-list-tile-action>
              <v-btn icon>
                <v-icon>arrow_right</v-icon>
              </v-btn>
            </v-list-tile-action>
            <!-- </v-layout> -->
          </v-list-tile>

          <v-list-tile
            replace
            to="/resource-pack-setting"
            avatar
          >
            <v-list-tile-action>
              <v-icon>palette</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $tc("resourcepack.name", 2) }}
              </v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("resourcepack.hint") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn icon>
                <v-icon>arrow_right</v-icon>
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>

          <v-list-tile
            replace
            to="/mod-setting"
            avatar
          >
            <v-list-tile-action>
              <v-icon>extensions</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $tc("mod.name", 2) }}
              </v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("mod.hint") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn icon>
                <v-icon>arrow_right</v-icon>
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>

          <v-list-tile
            replace
            to="/save"
            avatar
          >
            <v-list-tile-action>
              <v-icon>map</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $tc("save.name", 2) }}
              </v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("save.hint") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn icon>
                <v-icon>arrow_right</v-icon>
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>

          <v-list-tile
            avatar
            @click="hideLauncher = !hideLauncher"
          >
            <v-list-tile-action>
              <v-checkbox
                v-model="hideLauncher"
                hide-details
                @click="hideLauncher = !hideLauncher"
              />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>
                {{
                  $t("launch.hideLauncher")
                }}
              </v-list-tile-title>
              <!-- <v-list-tile-sub-title>
                {{ $t("launch.hideLauncher") }}
              </v-list-tile-sub-title> -->
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile
            avatar
            @click="showLog = !showLog"
          >
            <v-list-tile-action>
              <v-checkbox
                v-model="showLog"
                hide-details
                @click="showLog = !showLog"
              />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t("launch.showLog") }}</v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("launch.showLogHint") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>

          <v-subheader style="padding-right: 2px">
            {{ $tc("profile.modpack.name", 1) }}
          </v-subheader>
          <v-list-tile v-if="!isServer">
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $t("profile.modpack.author") }}
              </v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("profile.modpack.authorHint") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action style="flex-grow: 0">
              <v-text-field
                v-model="author"
                hide-details
                dark
                :placeholder="username"
                required
              />
            </v-list-tile-action>
          </v-list-tile>

          <!-- <v-list-tile v-if="!isServer">
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $t("profile.url") }}
              </v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t("profile.url") }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action style="width: 50%">
              <v-text-field
                v-model="url"
                hide-details
                placeholder="www.whatever.com"
              />
            </v-list-tile-action>
          </v-list-tile> -->
          <v-list-tile
            v-if="!isServer"
            style="margin-top: 5px"
          >
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $t("profile.modpack.description") }}
              </v-list-tile-title>
              <v-list-tile-sub-title style="height: 50px">
                <v-text-field
                  v-model="description"
                  style="padding-top: unset margin-top: unset margin-bottom: 5px"
                  hide-details
                  :placeholder="$t('profile.modpack.descriptionHint')"
                />
                <!-- {{ $t("profile.modpack.descriptionHint") }} -->
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <!-- <v-list-tile-action style="width: 50%">
              <v-text-field v-model="description" hide-details />
            </v-list-tile-action> -->
          </v-list-tile>

          <v-subheader
            v-if="isServer"
            style="padding-right: 2px"
          >
            {{ $tc("profile.server", 1) }}
          </v-subheader>
          <v-list-tile v-if="isServer">
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $t("profile.server.host") }}
              </v-list-tile-title>
              <!-- <v-list-tile-sub-title>
                {{ $t("java.memoryHint") }}
              </v-list-tile-sub-title> -->
            </v-list-tile-content>
            <v-list-tile-action>
              <v-text-field
                v-model="host"
                hide-details
                dark
                placeholder="www.whatever.com"
                required
              />
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile v-if="isServer">
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $t("profile.server.port") }}
              </v-list-tile-title>
              <!-- <v-list-tile-sub-title> -->
              <!-- {{ $t("java.memoryHint") }} -->
              <!-- </v-list-tile-sub-title> -->
            </v-list-tile-content>
            <v-list-tile-action>
              <v-text-field
                v-model="port"
                hide-details
                dark
                placeholder="25565"
                required
              />
            </v-list-tile-action>
          </v-list-tile>
        </v-list>
      </v-flex>
      <launch-view style="margin-bottom: 10px" />
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs } from '@vue/composition-api'
import LaunchView from './BaseSettingPageLaunchView.vue'
import { useAutoSaveLoad, useGameProfile, useInstance, useProfileId, useRouter, useSelectedUser } from '/@/hooks'

export default defineComponent({
  components: { LaunchView },
  setup() {
    const {
      runtime,
      isServer,
      showLog,
      hideLauncher,
      name,
      author,
      url,
      description,
      server,
      editInstance: edit,
    } = useInstance()
    const router = useRouter()
    const { userId, profileId } = useSelectedUser()
    const { gameProfile } = useProfileId(userId, profileId)
    const { name: username } = useGameProfile(gameProfile)
    const data: {
      active: number
      valid: boolean
      hideLauncher: boolean
      showLog: boolean
      name: string
      host: string
      port: string
      author: string
      description: string
      url: string
    } = reactive({
      active: 0,
      valid: true,
      hideLauncher: false,
      showLog: false,
      name: '',

      host: '', // mc.hypixel.com
      port: '', // 25565

      author: '',
      description: '',
      url: '',
    })

    function save() {
      const payload = {
        name: data.name,
        hideLauncher: data.hideLauncher,
        url: data.url,
        showLog: data.showLog,
      }
      if (!isServer.value) {
        edit({
          ...payload,
          author: data.author,
          description: data.description,
        })
      } else {
        edit({
          ...payload,
          server: {
            host: data.host,
            port: Number.parseInt(data.port, 10),
          },
        })
      }
    }
    function load() {
      data.name = name.value
      data.hideLauncher = hideLauncher.value
      data.url = url.value
      data.showLog = showLog.value
      data.author = author.value
      data.description = description?.value || ''
      if (server.value) {
        data.host = server.value.host
        data.port = server.value.port?.toString() || ''
      }
    }
    useAutoSaveLoad(save, load)

    function goVersionPage() {
      router.replace('/version-setting')
    }
    return {
      ...toRefs(data),
      username,
      isServer,
      version: runtime,
      goVersionPage,
    }
  },
})
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
<style>
.local-version .v-select__selection--comma {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.base-settings {
  background: transparent !important;
  width: 100%;
}
.base-settings .v-text-field--box input,
.v-text-field--full-width input,
.v-text-field--outline input {
  margin-top: 0
}

/* .base-settings .v-list__tile__content {
  flex-grow: 1
  max-width: 40%
} */
</style>
