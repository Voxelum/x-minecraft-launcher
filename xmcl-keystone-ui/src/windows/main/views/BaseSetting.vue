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
        class="headline"
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
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>{{ $t("profile.name") }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("profile.nameHint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-text-field
                v-model="name"
                small
                hide-details

                :placeholder="`Minecraft ${version.minecraft}`"
              />
            </v-list-item-action>
          </v-list-item>
          <v-list-item
            push
            to="/version-setting"
          >
            <v-list-item-content>
              <v-list-item-title>{{ $t("profile.version") }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("profile.versionHint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <!-- <v-layout > -->
            <v-list-item-action
              class="gap-3"
              style="display: flex; flex-grow: 1; flex-direction: row; justify-content: flex-end;;"
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
                {{ $tc("resourcepack.name", 2) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("resourcepack.hint") }}
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
                {{ $tc("shaderpack.name", 2) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("shaderpack.hint") }}
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
                {{ $tc("mod.name", 2) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("mod.hint") }}
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
                {{ $tc("save.name", 2) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("save.hint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn icon>
                <v-icon>arrow_right</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>

          <v-list-item
            @click="hideLauncher = !hideLauncher"
          >
            <v-list-item-action>
              <v-checkbox
                v-model="hideLauncher"
                hide-details
                @click="hideLauncher = !hideLauncher"
              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{
                  $t("launch.hideLauncher")
                }}
              </v-list-item-title>
              <!-- <v-list-item-subtitle>
                {{ $t("launch.hideLauncher") }}
              </v-list-item-subtitle> -->
            </v-list-item-content>
          </v-list-item>
          <v-list-item
            @click="showLog = !showLog"
          >
            <v-list-item-action>
              <v-checkbox
                v-model="showLog"
                hide-details
                @click="showLog = !showLog"
              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ $t("launch.showLog") }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("launch.showLogHint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>

          <v-subheader style="padding-right: 2px">
            {{ $tc("profile.modpack.name", 1) }}
          </v-subheader>
          <v-list-item v-if="!isServer">
            <v-list-item-content>
              <v-list-item-title>
                {{ $t("profile.modpack.author") }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("profile.modpack.authorHint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action style="flex-grow: 0">
              <v-text-field
                v-model="author"
                hide-details

                :placeholder="username"
                required
              />
            </v-list-item-action>
          </v-list-item>
          <v-list-item
            v-if="!isServer"
            style="margin-top: 5px"
          >
            <v-list-item-content>
              <v-list-item-title>
                {{ $t("profile.modpack.description") }}
              </v-list-item-title>
              <v-list-item-subtitle style="height: 50px">
                <v-text-field
                  v-model="description"
                  style="padding-top: unset; margin-top: unset; margin-bottom: 5px"
                  hide-details
                  :placeholder="$t('profile.modpack.descriptionHint')"
                />
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>

          <v-list-item v-if="!isServer">
            <v-list-item-content>
              <v-list-item-title>
                {{ $t("profile.url") }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("profile.urlHint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action style="width: 50%">
              <v-text-field
                v-model="url"
                hide-details
                placeholder="www.whatever.com"
              />
            </v-list-item-action>
          </v-list-item>
          <v-list-item v-if="!isServer">
            <v-list-item-content>
              <v-list-item-title>
                {{ $t("profile.fileApi") }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("profile.fileApiHint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action style="width: 50%">
              <v-text-field
                v-model="fileServerApi"
                hide-details
                placeholder="www.myfileserver.com/root"
              />
            </v-list-item-action>
          </v-list-item>

          <v-subheader
            v-if="isServer"
            style="padding-right: 2px"
          >
            {{ $tc("profile.server", 1) }}
          </v-subheader>
          <v-list-item v-if="isServer">
            <v-list-item-content>
              <v-list-item-title>
                {{ $t("profile.server.host") }}
              </v-list-item-title>
              <!-- <v-list-item-subtitle>
                {{ $t("java.memoryHint") }}
              </v-list-item-subtitle> -->
            </v-list-item-content>
            <v-list-item-action>
              <v-text-field
                v-model="host"
                hide-details

                placeholder="www.whatever.com"
                required
              />
            </v-list-item-action>
          </v-list-item>
          <v-list-item v-if="isServer">
            <v-list-item-content>
              <v-list-item-title>
                {{ $t("profile.server.port") }}
              </v-list-item-title>
              <!-- <v-list-item-subtitle> -->
              <!-- {{ $t("java.memoryHint") }} -->
              <!-- </v-list-item-subtitle> -->
            </v-list-item-content>
            <v-list-item-action>
              <v-text-field
                v-model="port"
                hide-details

                placeholder="25565"
                required
              />
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-flex>
      <LaunchSettings style="margin-bottom: 10px" />
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { useAutoSaveLoad, useRouter } from '/@/composables'
import { useInstance } from '../composables/instance'
import { useGameProfile, useProfileId, useSelectedUser } from '../composables/user'
import LaunchSettings from './BaseSettingLaunch.vue'

export default defineComponent({
  components: { LaunchSettings },
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
      fileApi,
      editInstance: edit,
    } = useInstance()
    const router = useRouter()
    const { userId, profileId } = useSelectedUser()
    const { gameProfile } = useProfileId(userId, profileId)
    const { name: username } = useGameProfile(gameProfile)
    const data = reactive({
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
      fileServerApi: '',
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
          fileApi: data.fileServerApi,
          author: data.author,
          description: data.description,
        })
      } else {
        edit({
          ...payload,
          fileApi: data.fileServerApi,
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
      data.fileServerApi = fileApi.value
      data.description = description?.value || ''
      if (server.value) {
        data.host = server.value.host
        data.port = server.value.port?.toString() || ''
      }
    }
    useAutoSaveLoad(save, load)

    function goVersionPage() {
      router.push('/version-setting')
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
.v-text-field--outlined input {
  margin-top: 0
}

/* .base-settings .v-list__tile__content {
  flex-grow: 1
  max-width: 40%
} */
</style>
