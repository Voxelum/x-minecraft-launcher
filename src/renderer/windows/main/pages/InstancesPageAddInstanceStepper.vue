<template>
  <v-stepper
    v-model="step"
    dark
  >
    <v-stepper-header>
      <v-stepper-step
        :rules="[() => valid]"
        :editable="notImporting"
        :complete="step > 0"
        step="0"
      >
        {{ $t('profile.templateSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        :rules="[() => valid]"
        :editable="notImporting"
        :complete="step > 1"
        step="1"
      >
        {{ $t('profile.baseSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        :editable="notImporting"
        :complete="step > 2"
        step="2"
      >
        {{ $t('profile.advancedSetting') }}
        <small>{{ $t('optional') }}</small>
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        :complete="step > 3"
        step="3"
      >
        {{ $t('profile.templateSetting.importing') }}
      </v-stepper-step>
    </v-stepper-header>

    <v-stepper-items>
      <v-stepper-content step="0">
        <v-container
          grid-list
          fill-height
        >
          <v-layout
            row
            wrap
          >
            <v-flex
              d-flex
              xs12
            >
              <v-list
                style="background: transparent"
                two-line
              >
                <v-list-tile
                  v-for="(p, i) in templates"
                  :key="p.path"
                  ripple
                  @click="selectTemplate(i, p)"
                >
                  <v-list-tile-action>
                    <v-checkbox
                      :value="template === i"
                      readonly
                    />
                  </v-list-tile-action>
                  <v-list-tile-content>
                    <v-list-tile-title>{{ p.title }}</v-list-tile-title>
                    <v-list-tile-sub-title>{{ p.subTitle }},</v-list-tile-sub-title>
                  </v-list-tile-content>

                  <v-list-tile-action>
                    <v-list-tile-action-text>{{ p.action }}</v-list-tile-action-text>
                  </v-list-tile-action>
                </v-list-tile>
              </v-list>
            </v-flex>
          </v-layout>
        </v-container>
        <v-layout>
          <v-btn
            :diable="creating"
            flat
            @click="quit"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            flat
            @click="step = 1"
          >
            {{ $t('next') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
      <v-stepper-content step="1">
        <v-form
          ref="form"
          v-model="valid"
          lazy-validation
          style="height: 100%;"
        >
          <v-container
            grid-list
            fill-height
          >
            <v-layout
              row
              wrap
            >
              <v-flex
                d-flex
                xs4
              >
                <v-text-field
                  v-model="name"
                  dark
                  persistent-hint
                  :hint="$t('profile.nameHint')"
                  :label="$t('name')"
                  :rules="nameRules"
                  required
                />
              </v-flex>
              <v-flex
                d-flex
                xs4
              >
                <v-text-field
                  v-model="author"
                  dark
                  persistent-hint
                  :hint="$t('profile.authorHint')"
                  :label="$t('author')"
                  required
                />
              </v-flex>
              <v-flex
                d-flex
                xs4
              >
                <minecraft-version-menu @input="runtime.minecraft = $event">
                  <template v-slot="{ on }">
                    <v-text-field
                      v-model="runtime.minecraft"
                      dark
                      append-icon="arrow"
                      persistent-hint
                      :hint="$t('profile.versionHint')"
                      :label="$t('minecraft.version')"
                      :readonly="true"
                      @click:append="on.keydown"
                      v-on="on"
                    />
                  </template>
                </minecraft-version-menu>
              </v-flex>
              <v-flex
                d-flex
                xs12
              >
                <v-text-field
                  v-model="description"
                  dark
                  persistent-hint
                  :hint="$t('profile.descriptionHint')"
                  :label="$t('description')"
                />
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>
        <v-layout>
          <v-btn
            flat
            :disable="creating"
            @click="quit"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            flat
            @click="step = 2"
          >
            {{ $t('next') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="creating"
            :disabled="!valid || name === '' || runtime.minecraft === ''"
            @click="doCreate"
          >
            {{ $t('create') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
      <v-stepper-content step="2">
        <v-form
          v-model="valid"
          lazy-validation
          style="height: 100%;"
        >
          <v-container
            grid-list
            fill-height
            style="overflow: auto;"
          >
            <v-layout
              row
              wrap
            >
              <v-flex
                d-flex
                xs6
              >
                <v-select
                  v-model="javaInstance"
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
              <v-flex
                d-flex
                xs3
              >
                <v-text-field
                  v-model="minMemory"
                  hide-details
                  type="number"
                  :label="$t('java.minMemory')"
                  :placeholder="$t('java.autoAlloc')"
                  required
                />
              </v-flex>
              <v-flex
                d-flex
                xs3
              >
                <v-text-field
                  v-model="maxMemory"
                  hide-details
                  type="number"
                  :label="$t('java.maxMemory')"
                  :placeholder="$t('java.autoAlloc')"
                  required
                />
              </v-flex>
              <v-flex
                d-flex
                xs6
              >
                <forge-version-menu
                  :minecraft="runtime.minecraft"
                  @input="runtime.forge = $event"
                >
                  <template v-slot="{ on }">
                    <v-text-field
                      v-model="runtime.forge"
                      dark
                      append-icon="arrow"
                      persistent-hint
                      :hint="$t('profile.versionHint')"
                      :label="$t('forge.version')"
                      :readonly="true"
                      @click:append="on.keydown"
                      v-on="on"
                    />
                  </template>
                </forge-version-menu>
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>

        <v-layout>
          <v-btn
            flat
            :disabled="creating"
            @click="quit"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            :loading="creating"
            :disabled="!valid || name === '' || runtime.minecraft === ''"
            @click="doCreate"
          >
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
import { reactive, toRefs, computed, onMounted, watch, defineComponent, ref, Ref } from '@vue/composition-api';
import { CurseforgeModpackResource } from '@universal/util/resource';
import { InstanceSchema } from '@universal/store/modules/instance.schema';
import {
  useI18n,
  useJava,
  useRouter,
  useInstanceTemplates,
  useCurseforgeImport,
  useInstanceCreation,
  useSelectedUser,
  useProfileId,
  useGameProfile,
} from '@/hooks';
import { Java } from '@universal/store/modules/java';
import { Modpack } from '@main/service/CurseForgeService';

interface InstanceTemplate {
  type: 'instance';
  title: string;
  subTitle: string;
  path: string;
  action: string;
  source: InstanceSchema;
}

interface ModpackTemplate {
  type: 'modpack';
  title: string;
  subTitle: string;
  path: string;
  action: string;
  source: CurseforgeModpackResource;
}

function setupTemplates() {
  const { $t } = useI18n();
  const { modpacks, instances } = useInstanceTemplates();
  const getModpackVersion = (modpack: Modpack) => {
    let version = `Minecraft: ${modpack.minecraft.version}`;
    if (modpack.minecraft.modLoaders && modpack.minecraft.modLoaders.length > 0) {
      for (let loader of modpack.minecraft.modLoaders) {
        version += ` ${loader.id}`;
      }
    }
    return version;
  };
  const getInstanceVersion = (inst: InstanceSchema) => {
    let version = `Minecraft: ${inst.runtime.minecraft}`;
    if (inst.runtime.forge) {
      version += ` Forge: ${inst.runtime.forge}`;
    }
    if (inst.runtime.fabricLoader) {
      version += ` Fabric: ${inst.runtime.fabricLoader}`;
    }
    return version;
  };
  const templates = computed(() => [
    ...instances.value.map((instance) => ({
      type: 'instance',
      title: instance.name,
      subTitle: getInstanceVersion(instance),
      path: instance.path,
      source: instance,
      action: $t(`profile.templateSetting.${instance.server ? 'server' : 'profile'}`),
    }) as InstanceTemplate),
    ...modpacks.value.map((modpack) => ({
      type: 'modpack',
      title: `${modpack.metadata.name}-${modpack.metadata.version}`,
      subTitle: getModpackVersion(modpack.metadata),
      path: modpack.path,
      source: modpack,
      action: $t('profile.templateSetting.modpack'),
    }) as ModpackTemplate),
  ]);

  return {
    templates,
  };
}

export default defineComponent({
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    initialTemplate: String,
  },
  setup(props, context) {
    const { $t } = useI18n();
    const { create, reset, use, ...creationData } = useInstanceCreation();
    const router = useRouter();
    const staticData = {
      memoryRule: [(v: any) => Number.isInteger(v)],
      nameRules: [
        (v: any) => !!v || $t('profile.requireName'),
      ],
    };
    const data = reactive({
      template: -1,
      creating: false,

      step: 1,
      valid: false,

      javaValid: true,
    });

    const importTask: Ref<Promise<string> | null> = ref(null);
    const notImporting = computed(() => importTask.value === null);

    const { userId, profileId } = useSelectedUser();
    const { gameProfile } = useProfileId(userId, profileId);
    const { name } = useGameProfile(gameProfile);
    const { all: javas } = useJava();
    const { templates } = setupTemplates();
    const { importCurseforgeModpack } = useCurseforgeImport();
    const ready = computed(() => data.valid && data.javaValid);
    const java = ref(undefined as undefined | Java);

    function selectTemplate(index: number, template: InstanceTemplate | ModpackTemplate) {
      if (template.type === 'modpack') {
        data.template = index;
        const metadata = template.source.metadata;
        creationData.name.value = `${metadata.name} - ${metadata.version}`;
        creationData.runtime.value!.minecraft = metadata.minecraft.version;
        creationData.author.value = metadata.author;
        data.step = 1;
      } else {
        data.template = index;
        data.step = 1;
        use(template.source);
        creationData.author.value = name.value;
      }
    }
    function quit() {
      if (data.creating) return;
      context.emit('quit');
    }
    function init() {
      reset();
      data.step = 1;
      data.template = props.initialTemplate ? templates.value.findIndex(m => m.path === props.initialTemplate) : -1;
      if (data.template !== -1) {
        selectTemplate(data.template, templates.value[data.template]);
      }
      data.creating = false;
    }
    async function doCreate() {
      data.creating = true;
      try {
        if (data.template !== -1) {
          if (templates.value[data.template].type === 'modpack') {
            data.step = 3;
            importTask.value = importCurseforgeModpack({
              path: templates.value[data.template].path,
            });
            await importTask.value;
          } else {
            await create();
          }
        } else {
          await create();
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        init();
        router.replace('/');
        data.template = -1;
      } finally {
        data.creating = false;
      }
    }
    onMounted(() => {
      watch(computed(() => props.show), (v) => {
        if (!v) return;
        init();
      });
    });
    return {
      ...toRefs(data),
      ...staticData,
      ...creationData,
      javaInstance: java,
      importTask,
      notImporting,
      quit,
      javas,
      selectTemplate,
      doCreate,
      ready,
      templates,
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
