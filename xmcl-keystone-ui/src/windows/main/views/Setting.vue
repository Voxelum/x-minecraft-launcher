<template>
  <v-container
    fluid
    style="z-index: 2; overflow: auto"
    class="overflow-auto h-full"
  >
    <v-layout
      wrap
      class="overflow-auto h-full"
    >
      <!-- <v-flex
        d-flex
        xs12
        tag="h1"
        class="white--text"
      >
        <span class="headline">{{ $tc("setting.name", 2) }}</span>
      </v-flex>-->
      <v-flex
        d-flex
        xs12
      >
        <v-list
          three-line
          subheader
          style="background: transparent; width: 100%"
        >
          <v-subheader class>
            {{ $t("setting.general") }}
          </v-subheader>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>
                {{
                  $t("setting.language")
                }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{
                  $t("setting.languageDescription")
                }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-select
                v-model="selectedLocale"
                filled
                style="max-width: 185px"
                hide-details
                :items="locales"
              />
            </v-list-item-action>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>
                {{
                  $t("setting.location")
                }}
              </v-list-item-title>
              <v-list-item-subtitle>{{ rootLocation }}</v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action class="self-center">
              <v-btn
                outlined
                text
                style="margin-right: 10px"
                @click="browseRootDir"
              >
                {{ $t("setting.browseRoot") }}
              </v-btn>
            </v-list-item-action>
            <v-list-item-action class="self-center">
              <v-btn
                outlined
                text
                @click="showRootDir"
              >
                {{ $t("setting.showRoot") }}
              </v-btn>
            </v-list-item-action>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>
                {{
                  $t("setting.useBmclAPI")
                }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{
                  $t("setting.useBmclAPIDescription")
                }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-select
                v-model="apiSetsPreference"
                filled
                style="max-width: 185px"
                hide-details
                :items="apiSets"
                item-text="name"
              />
            </v-list-item-action>
          </v-list-item>
          <v-list-item>
            <v-list-item-action class="self-center">
              <v-checkbox v-model="httpProxyEnabled" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{
                  $t("setting.useProxy")
                }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{
                  $t("setting.useProxyDescription")
                }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action class="flex flex-row flex-grow-0 gap-1">
              <v-text-field
                v-model="proxy.host"
                :disabled="!httpProxyEnabled"
                filled
                dense
                hide-details
                :label="$t('proxy.host')"
              />
              <v-text-field
                v-model="proxy.port"
                :disabled="!httpProxyEnabled"
                class="w-20"
                filled
                dense
                hide-details
                type="number"
                :label="$t('proxy.port')"
              />
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-flex>
      <v-divider />
      <v-list
        three-line
        subheader
        style="background: transparent"
        class="flex-grow"
      >
        <v-subheader v-if="!disableUpdate">
          {{ $t("setting.update") }}
        </v-subheader>
        <v-list-item v-if="!disableUpdate">
          <v-list-item-action class="self-center">
            <v-btn
              icon
              :loading="checkingUpdate"
              @click="checkUpdate"
            >
              <v-icon>refresh</v-icon>
            </v-btn>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.latestVersion")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              v{{ version }}
              {{
                hasNewUpdate && updateInfo ? `-> ${updateInfo.name}` : ""
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action class="self-center">
            <v-btn
              :loading="checkingUpdate"
              :disabled="updateStatus === 'none'"
              :color="updateStatus !== 'none' ? 'primary' : ''"
              :text="updateStatus === 'none'"
              @click="viewUpdateDetail"
            >
              {{
                updateStatus === "none"
                  ? $t("setting.alreadyLatest")
                  : updateStatus === "pending"
                    ? $t("setting.updateToThisVersion")
                    : $t("setting.installAndQuit")
              }}
            </v-btn>
          </v-list-item-action>
        </v-list-item>
        <!-- <v-list-item avatar>
            <v-list-item-action>
              <v-checkbox v-model="autoInstallOnAppQuit" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ $t('setting.autoInstallOnAppQuit') }}</v-list-item-title>
              <v-list-item-subtitle>{{ $t('setting.autoInstallOnAppQuitDescription') }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item avatar>
            <v-list-item-action>
              <v-checkbox
                v-model="autoDownload"

              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ $t('setting.autoDownload') }}</v-list-item-title>
              <v-list-item-subtitle>{{ $t('setting.autoDownloadDescription') }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item avatar>
            <v-list-item-action>
              <v-checkbox v-model="allowPrerelease" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ $t('setting.allowPrerelease') }}</v-list-item-title>
              <v-list-item-subtitle>{{ $t('setting.allowPrereleaseDescription') }}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>-->
        <v-subheader>{{ $t("setting.appearance") }}</v-subheader>
        <v-list-item class="justify-center items-center">
          <v-list-item-action class="self-center">
            <v-checkbox v-model="darkTheme" />
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.darkTheme")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.darkThemeDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-action class="self-center">
            <v-checkbox v-model="blurMainBody" />
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.blurMainBody")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.blurMainBodyDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.backgroundType")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.backgroundTypeDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-select
              v-model="backgroundType"
              filled
              :items="backgroundTypes"
            />
          </v-list-item-action>
        </v-list-item>
        <!-- <v-list-item v-if="backgroundType === 'halo'">
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.particleMode")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.particleModeDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-select v-model="particleMode" :items="particleModes" />
          </v-list-item-action>
        </v-list-item>-->
        <v-list-item v-if="backgroundType === 'particle'">
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.particleMode")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.particleModeDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-select
              v-model="particleMode"
              filled
              :items="particleModes"
            />
          </v-list-item-action>
        </v-list-item>
        <v-list-item v-if="backgroundType === 'image'">
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.backgroundImage")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.backgroundImageDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action class="mr-4">
            <v-select
              v-model="backgroundImageFit"
              class="w-40 mr-4"
              filled
              hide-details
              :label="$t('setting.backgroundImageFit.name')"
              :items="backgroundImageFits"
            />
          </v-list-item-action>
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            :disabled="!backgroundImage"
            @click="clearImage"
          >
            {{ $t("setting.backgroundImageClear") }}
          </v-btn>
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            @click="selectImage"
          >
            {{ $t("setting.backgroundImageSelect") }}
          </v-btn>
        </v-list-item>
        <v-list-item v-if="backgroundType === 'video'">
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.backgroundVideo")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.backgroundVideoDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <!-- <v-list-item-action class="mr-4">
            <v-select
              v-model="backgroundImageFit"
              class="w-40 mr-4"
              filled
              hide-details
              :label="$t('setting.backgroundImageFit.name')"
              :items="backgroundImageFits"
            />
          </v-list-item-action>-->
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            :disabled="!backgroundVideo"
            @click="clearVideo"
          >
            {{ $t("setting.backgroundImageClear") }}
          </v-btn>
          <v-btn
            outlined
            text
            style="margin-right: 10px"
            @click="selectVideo"
          >
            {{ $t("setting.backgroundVideoSelect") }}
          </v-btn>
        </v-list-item>
        <v-list-item v-if="backgroundType !== BackgroundType.VIDEO">
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.backgroundImageBlur")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.backgroundImageBlurDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-slider
            v-model="blur"
            :min="0"
            :max="100"
            :hint="$t('setting.backgroundBlur')"
            :always-dirty="true"
          />
        </v-list-item>
        <v-list-item v-if="backgroundType === BackgroundType.VIDEO">
          <v-list-item-content>
            <v-list-item-title>
              {{
                $t("setting.backgroundVideoVolume")
              }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                $t("setting.backgroundVideoVolumeDescription")
              }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-slider
            v-model="volume"
            step="0.01"
            :min="0"
            :max="1"
            :hint="$t('setting.VideoVolume')"
            :always-dirty="true"
          />
        </v-list-item>
      </v-list>
    </v-layout>

    <update-info-dialog v-model="viewingUpdateDetail" />
    <v-dialog
      :value="migrateDialog"
      persistent
    >
      <v-card v-if="migrateState === 0">
        <v-card-title>
          <h2 style="display: block; min-width: 100%">
            {{ $t("setting.setRootTitle") }}
          </h2>
          <v-text-field
            :value="rootLocation"
            readonly
            hide-details
          />
        </v-card-title>
        <v-card-text>
          <p>{{ $t("setting.setRootDescription") }}</p>
          <p>{{ $t("setting.setRootCause") }}</p>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-btn
            text
            large
            @click="doCancelApplyRoot"
          >
            {{ $t("cancel") }}
          </v-btn>
          <v-spacer />
          <v-btn
            text
            large
            @click="doApplyRoot()"
          >
            {{ $t("setting.apply") }}
          </v-btn>
        </v-card-actions>
      </v-card>
      <v-card v-else-if="migrateState === 1">
        <v-card-title>
          <h2>{{ $t("setting.waitReload") }}</h2>
        </v-card-title>
        <v-spacer />
        <div style="display: flex; width: 100; justify-content: center">
          <v-progress-circular
            :size="100"
            color="white"
            indeterminate
          />
        </div>
      </v-card>
      <v-card v-else>
        <v-card-title>
          <h2 v-if="migrateError">
            {{ $t("setting.migrateFailed") }}
          </h2>
          <h2 v-else-if="!cleaningMigration">
            {{ $t("setting.migrateSuccess") }}
          </h2>
          <h2 v-else>
            {{ $t("setting.postMigrating") }}
          </h2>
        </v-card-title>
        <v-spacer />
        <v-card-text v-if="migrateError">
          {{ migrateError }}
        </v-card-text>
        <v-divider />
        <v-card-actions v-if="!migrateError">
          <v-checkbox
            v-model="clearData"
            style="margin-left: 10px"
            persistent-hint
            :hint="$t('setting.cleanOldDataHint')"
            :label="$t('setting.cleanOldData')"
          />
        </v-card-actions>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            color="primary"
            :loading="cleaningMigration"
            :disabled="cleaningMigration"
            @click="postMigrate"
          >
            {{ $t("setting.migrateDone") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { BaseServiceKey } from '@xmcl/runtime-api'
import localMapping from '/@/assets/localeMapping.json'
import { useI18n, useService } from '/@/composables'
import UpdateInfoDialog from './SettingUpdateInfoDialog.vue'
import { useLauncherVersion, useSettings } from '../composables/setting'
import { useBackground, BackgroundType } from '../composables/background'

function setupVideo() {
  const { showOpenDialog } = windowController
  const { setBackgroundVideo, backgroundVideo, backgroundType, volume } = useBackground()
  function selectVideo() {
    showOpenDialog({
      title: '选择视频',
      properties: ['openFile'],
      filters: [{
        name: 'video',
        extensions: ['mp4', 'ogg', 'webm'],
      }],
    }).then((v) => {
      const videoPath = 'video://' + v.filePaths[0]
      setBackgroundVideo(videoPath)
    })
  }
  function clearVideo() {
    backgroundVideo.value = ''
  }
  return {
    clearVideo,
    selectVideo,
    backgroundVideo,
    backgroundType,
    volume,
    BackgroundType,
  }
}

function setupImage() {
  const { showOpenDialog } = windowController
  const { backgroundImage, setBackgroundImage, blur, particleMode, backgroundType, blurMainBody, backgroundImageFit, volume } = useBackground()
  function selectImage() {
    showOpenDialog({
      title: '选择图片',
      properties: ['openFile'],
      filters: [{
        name: 'image',
        extensions: ['png', 'jpg'],
      }],
    }).then((v) => {
      const imagePath = v.filePaths[0]
      setBackgroundImage(imagePath)
    })
  }
  function clearImage() {
    backgroundImage.value = ''
  }
  return {
    blur,
    volume,
    blurMainBody,
    backgroundImageFit,
    backgroundImage,
    selectImage,
    clearImage,
    particleMode,
    backgroundType,
  }
}

export default defineComponent({
  components: { UpdateInfoDialog },
  setup(props, context) {
    const dialog = windowController
    const { migrate, postMigrate, openDirectory, state } = useService(BaseServiceKey)
    const settings = useSettings()
    const { $t } = useI18n()
    const disableUpdate = false // state.env !== 'raw'
    const data = reactive({
      rootLocation: state.root,

      clearData: false,
      migrateData: false,

      migrateDialog: false,

      migrateState: 0,
      cleaningMigration: false,
      migrateError: undefined as undefined | Error,

      viewingUpdateDetail: false,
    })

    const darkTheme = computed({
      get(): boolean { return context.root.$vuetify.theme.dark },
      set(v: boolean) { context.root.$vuetify.theme.dark = v },
    })

    const { version, build } = useLauncherVersion()
    const particleModes = computed(() => ['push', 'remove', 'repulse', 'bubble'].map(t => ({ value: t, text: $t(`setting.particleMode.${t}`) })))
    const backgroundImageFits = computed(() => [
      { value: 'cover', text: $t('setting.backgroundImageFit.cover') },
      { value: 'contain', text: $t('setting.backgroundImageFit.contain') },
    ])
    const backgroundTypes = computed(() => [
      { value: BackgroundType.NONE, text: $t('setting.backgroundTypes.none') },
      { value: BackgroundType.IMAGE, text: $t('setting.backgroundTypes.image') },
      { value: BackgroundType.PARTICLE, text: $t('setting.backgroundTypes.particle') },
      { value: BackgroundType.HALO, text: $t('setting.backgroundTypes.halo') },
      { value: BackgroundType.VIDEO, text: $t('setting.backgroundTypes.video') },
    ])
    const hasNewUpdate = computed(() => settings.updateInfo.value?.name !== version.value)
    return {
      ...toRefs(data),
      ...settings,
      hasNewUpdate,
      version,
      build,
      locales: settings.locales.value.map(l => ({ text: (localMapping as any)[l] ?? l, value: l })),
      particleModes,
      viewUpdateDetail() {
        data.viewingUpdateDetail = true
      },
      showRootDir() {
        openDirectory(data.rootLocation)
      },
      async browseRootDir() {
        const { filePaths } = await dialog.showOpenDialog({
          title: $t('setting.selectRootDirectory'),
          defaultPath: data.rootLocation,
          properties: ['openDirectory', 'createDirectory'],
        })
        if (filePaths && filePaths.length !== 0) {
          data.rootLocation = filePaths[0]
          data.migrateDialog = true
        }
      },
      doCancelApplyRoot() {
        data.migrateDialog = false
        data.rootLocation = state.root
      },
      doApplyRoot() {
        data.migrateState = 1
        migrate({ destination: data.rootLocation })
          .catch((e) => {
            data.migrateError = e
          })
          .finally(() => {
            data.migrateState = 2
          })
      },
      postMigrate() {
        if (data.clearData) {
          data.cleaningMigration = true
          postMigrate().finally(() => {
            data.migrateDialog = false
            data.cleaningMigration = false
          })
        } else {
          data.migrateDialog = false
        }
      },
      disableUpdate,
      backgroundTypes,
      backgroundImageFits,
      ...setupImage(),
      ...setupVideo(),
      darkTheme,
    }
  },
})
</script>
