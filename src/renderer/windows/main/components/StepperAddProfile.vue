<template>
  <v-stepper v-model="step" dark>
    <v-stepper-header>
      <v-stepper-step :rules="[() => valid]" :editable="notImporting" :complete="step > 0" step="0">
        {{ $t('profile.templateSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step :rules="[() => valid]" :editable="notImporting" :complete="step > 1" step="1">
        {{ $t('profile.baseSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step :editable="notImporting" :complete="step > 2" step="2">
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
                <v-list-tile v-for="(p, i) in profiles" :key="p.id" ripple @click="selectProfileTemplate(i, p)">
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
                      {{ $t(`profile.templateSetting.${p.server ? 'server': 'profile'}`) }}
                    </v-list-tile-action-text>
                  </v-list-tile-action>
                </v-list-tile>

                <v-list-tile v-for="(p, i) in modpacks" 
                             :key="p.hash" 
                             ripple 
                             @click="selectModpackTemplate(i, p)">
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
                <version-menu @input="version.minecraft = $event">
                  <template v-slot="{ on }">
                    <v-text-field v-model="version.minecraft" 
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
                 :disabled="!valid || name === '' || version.minecraft === ''" 
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
                <v-select v-model="java.path" 
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
                <forge-version-menu :minecraft="version.minecraft" @input="version.forge = $event">
                  <template v-slot="{ on }">
                    <v-text-field v-model="version.forge" 
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
                 :disabled="!valid || name === '' || version.minecraft === ''" 
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

<script lang=ts>
import { reactive, toRefs, computed, onMounted, watch, createComponent, ref, Ref } from '@vue/composition-api';
import { CurseforgeModpackResource } from 'universal/store/modules/resource';
import { ServerOrModpack } from 'universal/store/modules/profile';
import {
  useI18n,
  useJava,
  useCurrentUser,
  useRouter,
  useProfileTemplates,
  useCurseforgeImport,
  useInstanceCreation,
} from '@/hooks';

export default createComponent({
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const { t } = useI18n();
    const { create, reset, use, ...creationData } = useInstanceCreation();
    const router = useRouter();
    const staticData = {
      memoryRule: [(v: any) => Number.isInteger(v)],
      nameRules: [
        (v: any) => !!v || t('profile.requireName'),
      ],
    };
    const data = reactive({
      template: -1,
      creating: false,

      step: 1,
      valid: false,

      javaValid: true,
    });
    const importTask: Ref<Promise<void> | null> = ref(null);
    const { name } = useCurrentUser();
    const { all: javas } = useJava();
    const { profiles, modpacks } = useProfileTemplates();
    const { importCurseforgeModpack } = useCurseforgeImport();
    const fromModpack = computed(() => data.template >= profiles.value.length);
    const ready = computed(() => data.valid && data.javaValid);
    const notImporting = computed(() => importTask.value === null);
    function init() {
      data.step = 1;
      reset();
    }
    function selectProfileTemplate(index: number, template: ServerOrModpack) {
      if (data.template === index) {
        data.template = -1;
        data.step = 1;
        return;
      }
      data.template = index;
      data.step = 1;
      use(template);
      creationData.author.value = name.value;
    }
    function selectModpackTemplate(index: number, template: CurseforgeModpackResource) {
      index += profiles.value.length;
      if (data.template === index) {
        data.template = -1;
        data.step = 1;
        return;
      }
      data.template = index;
      const metadata = template.metadata;
      creationData.name.value = metadata.name;
      creationData.version.value!.minecraft = metadata.minecraft.version;
      creationData.author.value = metadata.author;

      data.step = 1;
    }
    function quit() {
      if (data.creating) return;
      context.emit('quit');
    }
    onMounted(() => {
      watch(computed(() => props.show), (v) => {
        if (v) {
          init();
        }
      });
    });
    async function doCreate() {
      data.creating = true;
      try {
        if (data.template !== -1) {
          if (fromModpack.value) {
            data.step = 3;
            importTask.value = importCurseforgeModpack({
              path: modpacks.value[data.template - profiles.value.length].path,
            });
            await importTask.value;
          } else {
            await create();
          }
        } else {
          await create();
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
      ...creationData,
      importTask,
      notImporting,
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
