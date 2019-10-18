<template>
  <v-stepper v-model="step" dark>
    <v-stepper-header>
      <v-stepper-step :rules="[() => valid]" :editable="importTask ===''" :complete="step > 0" step="0">
        {{ $t('profile.templateSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step :rules="[() => valid]" :editable="importTask ===''" :complete="step > 1" step="1">
        {{ $t('profile.baseSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step :editable="importTask ===''" :complete="step > 2" step="2">
        {{ $t('profile.advancedSetting') }}
        <small>{{ $t('optional') }}</small>
      </v-stepper-step>
      <v-divider />
      <v-stepper-step :complete="step > 3" step="3">
        {{ $t('profile.templateSetting.importing') }}
      </v-stepper-step>
    </v-stepper-header>

    <v-stepper-items>
      <v-stepper-content step="0">
        <v-container grid-list fill-height>
          <v-layout row wrap>
            <v-flex d-flex xs12>
              <v-list style="background: transparent" two-line>
                <v-list-tile v-for="(p, i) in profiles" :key="p.id" ripple @click="selectProfileTemplate(i)">
                  <v-list-tile-action>
                    <v-checkbox :value="template === (i)" readonly />
                  </v-list-tile-action>
                  <v-list-tile-content>
                    <v-list-tile-title>
                      {{ p.name || `Minecraft: ${p.version.minecraft}` }}
                    </v-list-tile-title>
                    <v-list-tile-sub-title>
                      Minecraft: 
                      {{ p.version.minecraft }},

                      Forge:
                      {{ p.version.forge || 'None' }} {{ p.version.liteloader }}
                    </v-list-tile-sub-title>
                  </v-list-tile-content>
                 
                  <v-list-tile-action>
                    <v-list-tile-action-text>
                      {{ $t(`profile.templateSetting.${p.type === 'modpack' ? 'profile': 'server'}`) }}
                    </v-list-tile-action-text>
                  </v-list-tile-action>
                </v-list-tile>

                <v-list-tile v-for="(p, i) in modpacks" 
                             :key="p.hash" 
                             ripple 
                             @click="selectModpackTemplate(i)">
                  <v-list-tile-action>
                    <v-checkbox :value="template === (i - profiles.length)" readonly />
                  </v-list-tile-action>
                  <v-list-tile-content>
                    <v-list-tile-title>
                      {{ p.metadata.name }}
                    </v-list-tile-title>
                    <v-list-tile-sub-title>
                      Minecraft:
                      {{ p.metadata.minecraft.version }}
                    </v-list-tile-sub-title>
                  </v-list-tile-content>
                 
                  <v-list-tile-action>
                    <v-list-tile-action-text>
                      {{ $t('profile.templateSetting.modpack') }}
                    </v-list-tile-action-text>
                  </v-list-tile-action>
                </v-list-tile>
              </v-list>
            </v-flex>
          </v-layout>
        </v-container>
        <v-layout>
          <v-btn :diable="creating" flat @click="quit">
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn flat @click="step = 1">
            {{ $t('next') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
      <v-stepper-content step="1">
        <v-form ref="form" 
                v-model="valid" 
                lazy-validation 
                style="height: 100%;">
          <v-container grid-list fill-height>
            <v-layout row wrap>
              <v-flex d-flex xs4>
                <v-text-field v-model="name" 
                              dark 
                              persistent-hint 
                              :hint="$t('profile.nameHint')" 
                              :label="$t('name')"
                              :rules="nameRules"
                              required />
              </v-flex>
              <v-flex d-flex xs4>
                <v-text-field v-model="author" 
                              dark 
                              persistent-hint 
                              :hint="$t('profile.authorHint')" 
                              :label="$t('author')"
                              required />
              </v-flex>
              <v-flex d-flex xs4>
                <version-menu @input="mcversion = $event">
                  <template v-slot="{ on }">
                    <v-text-field v-model="mcversion" 
                                  dark 
                                  append-icon="arrow" 
                                  persistent-hint
                                  :hint="$t('profile.versionHint')" 
                                  :label="$t('minecraft.version')" 
                                  :readonly="true" 
                                  @click:append="on.keydown"
                                  v-on="on" />
                  </template>
                </version-menu>
              </v-flex>
              <v-flex d-flex xs12>
                <v-text-field v-model="description" 
                              dark 
                              persistent-hint 
                              :hint="$t('profile.descriptionHint')"
                              :label="$t('description')" />
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>
        <v-layout>
          <v-btn flat :disable="creating" @click="quit">
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn flat @click="step = 2">
            {{ $t('next') }}
          </v-btn>
          <v-btn color="primary" 
                 :loading="creating" 
                 :disabled="!valid || name === '' || mcversion === ''" 
                 @click="doCreate">
            {{ $t('create') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
      <v-stepper-content step="2">
        <v-form v-model="valid" lazy-validation style="height: 100%;">
          <v-container grid-list fill-height style="overflow: auto;">
            <v-layout row wrap>
              <v-flex d-flex xs6>
                <v-select v-model="javaLocation" 
                          class="java-select" 
                          :item-text="java => `JRE${java.majorVersion}, ${java.path}`"
                          :item-value="v => v" 
                          :label="$t('java.location')" 
                          :items="javas"
                          :menu-props="{ auto: true, overflowY: true }" 
                          prepend-inner-icon="add" 
                          hide-details
                          required 
                />
              </v-flex>
              <v-flex d-flex xs3>
                <v-text-field v-model="minMemory" 
                              hide-details 
                              type="number" 
                              :label="$t('java.minMemory')"
                              :placeholder="$t('java.autoAlloc')"
                              required />
              </v-flex>
              <v-flex d-flex xs3>
                <v-text-field v-model="maxMemory" 
                              hide-details 
                              type="number" 
                              :label="$t('java.maxMemory')"
                              :placeholder="$t('java.autoAlloc')"
                              required />
              </v-flex>
              <v-flex d-flex xs6>
                <forge-version-menu :minecraft="mcversion" @input="forgeVersion = $event">
                  <template v-slot="{ on }">
                    <v-text-field v-model="forgeVersion" 
                                  dark 
                                  append-icon="arrow" 
                                  persistent-hint
                                  :hint="$t('profile.versionHint')" 
                                  :label="$t('forge.version')" 
                                  :readonly="true" 
                                  @click:append="on.keydown"
                                  v-on="on" />
                  </template>
                </forge-version-menu>
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>

        <v-layout>
          <v-btn flat :disabled="creating" @click="quit">
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn color="primary" 
                 :loading="creating" 
                 :disabled="!valid || name === '' || mcversion === ''" 
                 @click="doCreate">
            {{ $t('create') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
      <v-stepper-content step="3">
        <task-focus :value="importTask" />
      </v-stepper-content>
    </v-stepper-items>
  </v-stepper>
</template>

<script>
import { reactive, toRefs, computed, onMounted, watch } from '@vue/composition-api';
import { useI18n, useProfileCreation, useJava, useProfileVersionBase, useProfile, useCurrentUser, useForgeVersions, useRouter, useProfileTemplates, useCurseforgeImport, useTask, useStore, useMinecraftVersions } from '../../../hooks';

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const { t } = useI18n();
    const { createAndSelectProfile } = useProfileCreation();
    const router = useRouter();
    const staticData = {
      memoryRule: [v => Number.isInteger(v)],
      nameRules: [
        v => !!v || t('profile.requireName'),
      ],
    };
    const data = reactive({
      template: -1,
      creating: false,

      step: 1,
      valid: false,

      name: '',
      mcversion: '',
      forgeVersion: '',
      javaLocation: undefined,
      maxMemory: undefined,
      minMemory: undefined,
      author: '',
      description: '',

      javaValid: true,

      importTask: '',
    });
    const { name } = useCurrentUser();
    const { all: javas, default: defaultJava } = useJava();
    const { release } = useMinecraftVersions();
    const { profiles, modpacks } = useProfileTemplates();
    const { importCurseforgeModpack } = useCurseforgeImport();
    const { dispatch } = useStore();
    const fromModpack = computed(() => data.template >= profiles.value.length);
    const template = computed(() => (!fromModpack.value ? profiles.value[data.template] : modpacks.value[data.template - profiles.value.length]));
    const ready = computed(() => data.valid && data.javaValid);
    function init() {
      data.step = 1;
      data.name = '';
      data.author = name.value;
      data.description = '';
      data.mcversion = release.value.id;
      data.forgeVersion = '';

      data.javaLocation = javas.value.find(j => j.path === defaultJava.value.path);
      data.minMemory = undefined;
      data.maxMemory = undefined;
    }
    function selectProfileTemplate(i) {
      if (data.template === i) {
        data.template = -1;
        data.step = 1;
        return;
      }
      data.template = i;
      const temp = template.value;
      data.mcversion = temp.version.minecraft;
      data.name = `${temp.name || `Minecraft: ${data.mcversion}`} +`;
      data.forgeVersion = temp.version.forge;
      if (temp.javaLocation) {
        data.javaLocation = javas.value.find(j => j.path === temp.javaLocation.path);
      }
      data.description = temp.description;

      data.step = 1;
    }
    function selectModpackTemplate(i) {
      i += profiles.length;
      if (data.template === i) {
        data.template = -1;
        data.step = 1;
        return;
      }
      data.template = i;
      const temp = template.value;
      data.name = temp.metadata.name;
      data.mcversion = temp.metadata.minecraft.version;
      data.author = temp.metadata.author;

      data.step = 1;
    }
    function quit() {
      if (data.creating) return;
      context.emit('quit');
    }
    onMounted(() => {
      watch(computed(() => props.show), () => {
        init();
      });
    });
    async function doCreate() {
      data.creating = true;
      try {
        if (data.template !== -1) {
          const temp = template.value;
          if (fromModpack.value) {
            data.step = 3;
            data.importTask = await importCurseforgeModpack({
              path: modpacks.value[data.template - profiles.value.length].path,
            });
            await dispatch('waitTask', data.importTask);
          } else {
            await createAndSelectProfile({
              ...temp,
              name: data.name,
              author: data.author,
              description: data.description,
              mcversion: data.mcversion,
              minMemory: data.minMemory,
              maxMemory: data.maxMemory,
              java: data.javaLocation,
              forge: {
                version: data.forgeVersion,
              },
            });
          }
        } else {
          await createAndSelectProfile({
            name: data.name,
            author: data.author,
            description: data.description,
            mcversion: data.mcversion,
            minMemory: data.minMemory,
            maxMemory: data.maxMemory,
            java: data.javaLocation,
            forge: {
              version: data.forgeVersion,
            },
          });
        }
        init();
        router.replace('/');
        data.template = -1;
      } finally {
        data.creating = false;
      }
    }
    return {
      ...toRefs(data),
      ...staticData,
      quit,
      javas,
      selectProfileTemplate,
      selectModpackTemplate,
      doCreate,
      ready,
      profiles,
      modpacks,
    };
  },
};
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
