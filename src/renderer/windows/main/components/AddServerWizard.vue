<template>
  <v-stepper v-model="step" non-linear dark>
    <v-stepper-header>
      <v-stepper-step :rules="[() => valid]" editable :complete="step > 1" step="1">
        {{ $t('profile.baseSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step editable :complete="step > 2" step="2">
        {{ $t('profile.advancedSetting') }}
        <small>{{ $t('optional') }}</small>
      </v-stepper-step>
      <v-divider />
    </v-stepper-header>

    <v-stepper-items>
      <v-stepper-content step="1">
        <v-form ref="form" v-model="valid" lazy-validation style="height: 100%;">
          <v-container grid-list fill-height>
            <v-layout row wrap>
              <v-flex d-flex xs12>
                <v-card>
                  <v-layout justify-center align-center>
                    <v-flex xs3>
                      <img :src="favicon" style="max-width: 80px; max-height: 80px; min-height: 80px; margin: 5px 0 0 30px;">
                    </v-flex>
                    <v-flex xs9>
                      <v-layout row>
                        <v-flex>
                          <v-icon left>
                            title
                          </v-icon>
                          {{ $t(version.name) }}
                        </v-flex>
                        <v-flex>
                          <v-icon left>
                            people
                          </v-icon>
                          {{ players.online + '/' + players.max }}
                        </v-flex>
                        <v-flex>
                          <v-icon left>
                            signal_cellular_alt
                          </v-icon>
                          {{ ping }}
                        </v-flex>
                      </v-layout>
                    </v-flex>
                  </v-layout>
                </v-card>
              </v-flex>
              <v-flex d-flex xs4>
                <v-text-field v-model="name" dark persistent-hint :hint="$t('profile.name')" :label="$t('profile.name')"
                              required />
              </v-flex>
              <v-flex d-flex xs4>
                <v-text-field v-model="host" dark persistent-hint :hint="$t('profile.server.hostHint')" :label="$t('profile.server.host')"
                              required />
              </v-flex>
              <v-flex d-flex xs4>
                <version-menu :accept-range="acceptingVersion" @input="mcversion = $event">
                  <template v-slot="{ on }">
                    <v-text-field v-model="mcversion" dark append-icon="arrow" persistent-hint
                                  :hint="$t('profile.server.versionHint')" :label="$t('minecraft.version')" :readonly="true" @click:append="on.keydown"
                                  v-on="on" />
                  </template>
                </version-menu>
              </v-flex>
              
              <v-flex d-flex xs4>
                <v-switch v-model="filterVersion" :label="$t('profile.server.filterVersion')" />
              </v-flex>
              <v-flex d-flex xs4 />
              <v-flex d-flex xs4>
                <v-btn :loading="pinging" :disabled="!host || !port" @click="refresh">
                  {{ $t('profile.server.ping') }}
                </v-btn>
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>
        <v-layout>
          <v-btn :disabled="creating" flat @click="quit">
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn flat @click="step = 2">
            {{ $t('next') }}
          </v-btn>
          <v-btn :loading="creating" color="primary" :disabled="!valid || name === '' || mcversion === ''" @click="doCreate">
            {{ $t('create') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
      <v-stepper-content step="2">
        <v-form v-model="valid" lazy-validation style="height: 100%;">
          <v-container grid-list fill-height style="overflow: auto;">
            <v-layout row wrap>
              <v-flex d-flex xs6>
                <v-select v-model="javaLocation" class="java-select" hide-details :item-text="java => `JRE${java.majorVersion}, ${java.path}`"
                          :item-value="v => v" prepend-inner-icon="add" :label="$t('java.location')" :items="javas"
                          required :menu-props="{ auto: true, overflowY: true }" />
              </v-flex>
              <v-flex d-flex xs3>
                <v-text-field v-model="minMemory" hide-details type="number" :label="$t('java.minMemory')"
                              required />
              </v-flex>
              <v-flex d-flex xs3>
                <v-text-field v-model="maxMemory" hide-details type="number" :label="$t('java.maxMemory')"
                              required />
              </v-flex>
              <v-flex d-flex xs6>
                <forge-version-menu :minecraft="mcversion" @input="forgeVersion = $event">
                  <template v-slot="{ on }">
                    <v-text-field v-model="forgeVersion" dark append-icon="arrow" persistent-hint
                                  :hint="$t('profile.versionHint')" :label="$t('forge.version')" :readonly="true" @click:append="on.keydown"
                                  v-on="on" />
                  </template>
                </forge-version-menu>
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>

        <v-layout>
          <v-btn :disabled="creating" flat @click="quit">
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn :loading="creating" color="primary" :disabled="!valid || name === '' || mcversion === ''" @click="doCreate">
            {{ $t('create') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
    </v-stepper-items>
  </v-stepper>
</template>

<script lang=ts>
import { reactive, toRefs, ref, computed, onMounted, onUnmounted, watch, createComponent } from '@vue/composition-api';
import { useMinecraftVersions, useForgeVersions, useJava, useServerStatus, useI18n, useServer, useRouter, useInstanceCreation } from '@/hooks';

export default createComponent({
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const { release, snapshot } = useMinecraftVersions();
    const latestVersion = computed(() => release.value!.id);
    const { create, reset, use, ...creationData } = useInstanceCreation();
    const { versions: forgeVersions, recommended, latest } = useForgeVersions(latestVersion);
    const { all: javas } = useJava();
    const { t } = useI18n();
    const router = useRouter();

    const staticData = {
      memoryRule: [(v: number) => Number.isInteger(v)],
      nameRules: [
        (v: string) => !!v || t('profile.requireName'),
      ],
    };
    const data = reactive({
      step: 1,
      valid: false,
      creating: false,

      filterVersion: false,
      javaValid: true,
    });
    const ready = computed(() => data.valid && data.javaValid);
    const dataRef = toRefs(data);

    const {
      favicon,
      acceptingVersion,
      refresh,
      version,
      players,
      ping,
      pinging,
    } = useServer(creationData);

    function init() {
      data.step = 1;
      reset();
    }
    function quit() {
      context.emit('quit');
    }
    async function doCreate() {
      try {
        data.creating = true;
        await create();
        init();
        router.replace('/');
      } finally {
        data.creating = false;
      }
    }
    let handle = () => { };
    onMounted(() => {
      handle = watch(computed(() => props.show), () => {
        if (props.show) {
          init();
        }
      });
    });
    onUnmounted(() => {
      handle();
    });

    return {
      ...toRefs(data),
      ...creationData,
      ...staticData,
      favicon,
      acceptingVersion,
      refresh,
      version,
      players,
      ping,
      ready,
      javas,
      doCreate,
      quit,
      pinging,
    };
  },
});
</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;

  max-width: 240px;
}
.v-stepper__step span {
  margin-right: 12px !important;
}
.v-stepper__step div {
  display: flex !important;
}
</style>
