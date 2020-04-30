<template>
  <v-form ref="form" v-model="valid" lazy-validation>
    <v-container grid-list-xs fill-height style="overflow: auto;">
      <v-layout row wrap justify-start align-start>
        <v-flex tag="h1" class="white--text" xs12>
          <span class="headline">{{ $t('profile.setting') }}</span>
        </v-flex>
        <v-flex d-flex xs6>
          <v-text-field v-model="name" outline hide-details dark :label="$t('profile.name')"
                        :placeholder="`Minecraft ${version.minecraft}`" />
        </v-flex>
        <v-flex d-flex xs6>
          <v-text-field outline hide-details dark readonly :value="version.minecraft"
                        :label="$t('profile.version')" @click="goVersionPage" @focus="goVersionPage" />
        </v-flex>
        <v-flex v-if="!isServer" d-flex xs6>
          <v-text-field v-model="author" outline hide-details dark :label="$t('profile.modpack.author')"
                        :placeholder="username" required />
        </v-flex>
        <v-flex v-if="isServer" d-flex xs6>
          <v-text-field v-model="host" outline hide-details dark :label="$t('profile.server.host')" placeholder="www.whatever.com"
                        required />
        </v-flex>
        <v-flex v-if="isServer" d-flex xs6>
          <v-text-field v-model="port" outline hide-details dark :label="$t('profile.server.port')" placeholder="25565"
                        required />
        </v-flex>
        <v-flex v-if="!isServer" d-flex xs6>
          <v-text-field v-model="url" outline hide-details dark :label="$t('profile.url')" placeholder="www.whatever.com"
                        required />
        </v-flex>
        <v-flex v-if="!isServer" d-flex xs12>
          <v-text-field v-model="description" outline hide-details dark :label="$t('profile.modpack.description')" />
        </v-flex>

        <v-flex d-flex xs6>
          <v-btn outline large replace to="/game-setting">
            {{ $tc('gamesetting.name', 2) }}
          </v-btn>
        </v-flex>
        <v-flex d-flex xs6>
          <v-btn outline large replace to="/advanced-setting">
            {{ $t('profile.launchingDetail') }}
          </v-btn>
        </v-flex>
        <v-flex d-flex xs6>
          <v-btn outline large replace to="/resource-pack-setting">
            {{ $tc('resourcepack.name', 2) }}
          </v-btn>
        </v-flex>
        <v-flex d-flex xs6>
          <v-btn outline large replace to="/mod-setting">
            {{ $tc('mod.name', 2) }}
          </v-btn>
        </v-flex>

        <v-flex d-flex xs6>
          <v-btn outline large replace to="/save">
            {{ $tc('save.name', 2) }}
          </v-btn>
        </v-flex>

        <v-flex d-flex xs6>
          <!-- <v-btn outline large replace to="/server">
            {{ $tc('server.name', 2) }}
          </v-btn> -->
        </v-flex>

        <v-flex d-flex xs6>
          <v-checkbox v-model="hideLauncher" hide-details dark :label="$t('launch.hideLauncher')" />
        </v-flex>
        <v-flex d-flex xs6>
          <v-checkbox v-model="showLog" hide-details dark :label="$t('launch.showLog')" />
        </v-flex>
      </v-layout>
    </v-container>
  </v-form>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent } from '@vue/composition-api';
import { useInstance, useAutoSaveLoad, useRouter, useCurrentUser } from '@/hooks';

export default defineComponent({
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
    } = useInstance();
    const router = useRouter();
    const { name: username } = useCurrentUser();
    const data: {
      active: number;
      valid: boolean;
      hideLauncher: boolean;
      showLog: boolean;
      name: string;
      host: string;
      port: string;
      author: string;
      description: string;
      url: string;
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
    });

    function save() {
      const payload = {
        name: data.name,
        hideLauncher: data.hideLauncher,
        url: data.url,
        showLog: data.showLog,
      };
      if (!isServer.value) {
        edit({
          ...payload,
          author: data.author,
          description: data.description,
        });
      } else {
        edit({
          ...payload,
          server: {
            host: data.host,
            port: Number.parseInt(data.port, 10),
          },
        });
      }
    }
    function load() {
      data.name = name.value;
      data.hideLauncher = hideLauncher.value;
      data.url = url.value;
      data.showLog = showLog.value;
      data.author = author.value;
      data.description = description?.value || '';
      if (server.value) {
        data.host = server.value.host;
        data.port = server.value.port?.toString() || '';
      }
    }
    useAutoSaveLoad(save, load);

    function goVersionPage() {
      router.replace('/version-setting');
    }
    return {
      ...toRefs(data),

      username,
      isServer,
      version: runtime,
      goVersionPage,
    };
  },
});
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}
.v-btn {
  margin: 0;
}
</style>
<style>
.local-version .v-select__selection--comma {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
