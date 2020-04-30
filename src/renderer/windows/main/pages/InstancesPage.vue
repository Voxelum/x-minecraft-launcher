<template>
  <v-container grid-list-md text-xs-center style="padding-left: 30px; padding-right: 30px; z-index: 1">
    <v-btn
      absolute
      fab
      color="primary"
      style="right: 20px; bottom: 20px;"
      :loading="pinging"
      @click="refresh"
    >
      <v-icon>refresh</v-icon>
    </v-btn>
    <v-layout row>
      <v-flex xs10>
        <v-text-field v-model="filter" hide-details append-icon="filter_list" :label="$t('filter')" solo dark color="green darken-1" />
      </v-flex>
      <v-flex xs1>
        <v-tooltip v-model="creatingTooltip" :close-delay="0" left>
          <template v-slot:activator="{ on }">
            <v-speed-dial open-on-hover style="z-index: 1" direction="bottom" transition="slide-y-reverse-transition">
              <template v-slot:activator>
                <v-btn flat fab dark small style="margin-left: 5px; margin-top: 5px;" @click="createProfile"
                       v-on="on">
                  <transition name="scale-transition" mode="out-in">
                    <v-icon v-if="!draggingInstance.path" key="a" dark style="font-size: 28px; transition: all 0.2s ease;">
                      add
                    </v-icon>
                    <v-icon v-else key="b" color="red" style="font-size: 28px; transition: all 0.2s ease;"
                            @drop="onDropDelete" @dragover.prevent>
                      delete
                    </v-icon>
                  </transition>
                </v-btn>
              </template>
              <v-btn style="z-index: 20;" fab small v-on="on" @mouseenter="enterAltCreate" @mouseleave="leaveAltCreate"
                     @click="createServer">
                <v-icon>storage</v-icon>
              </v-btn>
            </v-speed-dial>
          </template>
          {{ hoverTextOnCreate }}
        </v-tooltip>
      </v-flex>
      <v-flex xs1>
        <v-tooltip :close-delay="0" left>
          <template v-slot:activator="{ on }">
            <v-speed-dial open-on-hover style="z-index: 1" direction="bottom" transition="slide-y-reverse-transition">
              <template v-slot:activator>
                <v-btn flat fab dark small style="margin-left: 5px; margin-top: 5px;" @click="doImport(false, false)"
                       v-on="on">
                  <v-icon dark style="font-size: 28px">
                    save_alt
                  </v-icon>
                </v-btn>
              </template>
              <v-btn style="z-index: 20;" fab small v-on="on" @click="doImport(true, false)" @mouseenter="enterImport($t('profile.importFolder'))"
                     @mouseleave="leaveImport">
                <v-icon>folder</v-icon>
              </v-btn>
              <v-btn style="z-index: 20;" fab small v-on="on" @mouseenter="enterImport($t('profile.importCurseforge'))"
                     @mouseleave="leaveImport" @click="doImport(false, true)">
                <v-icon :size="12" style="padding-right: 2px;">
                  $vuetify.icons.curseforge
                </v-icon>
              </v-btn>
            </v-speed-dial>
          </template>
          {{ hoverTextOnImport }}
        </v-tooltip>
      </v-flex>
    </v-layout>
    <v-flex d-flex xs12 style="height: 10px;" />
    <v-layout row wrap style="overflow: scroll; max-height: 88vh;" justify-start fill-height>
      <v-flex v-if="instancesByTime[0].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.today') }}
      </v-flex>
      <v-flex v-for="instance in instancesByTime[0]" :key="instance.path" xs6
              @dragstart="dragStart(instance)" @dragend="dragEnd">
        <preview-card :profile="instance" @click.stop="selectInstance(instance.path)" />
      </v-flex>
      <v-flex v-if="instancesByTime[1].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.threeDay') }}
      </v-flex>
      <v-flex v-for="instance in instancesByTime[1]" :key="instance.path" xs6
              @dragstart="dragStart(instance)" @dragend="dragEnd">
        <preview-card :profile="instance" @click.stop="selectInstance(instance.path)" />
      </v-flex>
      <v-flex v-if="instancesByTime[2].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.older') }}
      </v-flex>
      <v-flex v-for="instance in instancesByTime[2]" :key="instance.path" xs6 
              @dragstart="dragStart(instance)" @dragend="dragEnd">
        <preview-card :profile="instance" @click.stop="selectInstance(instance.path)" />
      </v-flex>
    </v-layout>
    
    <delete-dialog :instance="deletingInstance" :confirm="doDelete" :cancel="cancelDelete" />
    <v-dialog v-model="wizard" persistent>
      <add-instance-stepper v-if="!creatingServer" :show="wizard" @quit="wizard=false" />
      <add-server-stepper v-else :show="wizard" @quit="wizard=false" />
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { reactive, toRefs, computed, onMounted, defineComponent, Ref, ref } from '@vue/composition-api';
import { Instance } from '@universal/store/modules/instance';
import {
  useI18n,
  useNativeDialog,
  useRouter,
  useInstances,
  useResourceOperation,
  useCurseforgeImport,
  useOperation,
} from '@/hooks';
import { Notify, useNotifier } from '../hooks';
import PreviewCard from './InstancesPagePreviewCard.vue';
import AddInstanceStepper from './InstancesPageAddInstanceStepper.vue';
import AddServerStepper from './InstancesPageAddServerStepper.vue';
import DeleteDialog from './InstancesPageDeleteDialog.vue';

function useFilteredInstances(instances: Ref<readonly Instance[]>, filter: Ref<string>) {
  return computed(() => {
    const filterString = filter.value.toLowerCase();
    return instances.value.filter(
      profile => filterString === ''
        || (profile.author
          ? profile.author.toLowerCase().indexOf(filterString) !== -1
          : false)
        || profile.name.toLowerCase().indexOf(filterString) !== -1
        || (profile.description
          ? profile.description.toLowerCase().indexOf(filterString) !== -1
          : false),
    );
  });
}

function useTimeslicedInstances(instances: Ref<readonly Instance[]>): Ref<[Instance[], Instance[], Instance[]]> {
  const now = Date.now();
  const oneDay = 1000 * 60 * 60 * 24;
  const threeDays = oneDay * 3;
  return computed(() => {
    const todayR = [];
    const threeR = [];
    const other = [];
    for (const p of instances.value) {
      const diff = now - p.lastAccessDate;
      if (diff <= oneDay) {
        todayR.push(p);
      } else if (diff <= threeDays) {
        threeR.push(p);
      } else {
        other.push(p);
      }
    }
    return [todayR, threeR, other];
  }) as any;
}

function useHoverTexts() {
  const { $t } = useI18n();
  const data = reactive({
    hoverTextOnCreate: $t('profile.add'),
    hoverTextOnImport: $t('profile.importZip'),
  });
  return {
    ...toRefs(data),
    enterAltCreate() {
      setTimeout(() => {
        data.hoverTextOnCreate = $t('profile.addServer');
      }, 100);
    },
    leaveAltCreate() {
      setTimeout(() => {
        data.hoverTextOnCreate = $t('profile.add');
      }, 100);
    },
    enterImport(text: string) {
      setTimeout(() => {
        data.hoverTextOnImport = text;
      }, 100);
    },
    leaveImport() {
      setTimeout(() => {
        data.hoverTextOnImport = $t('profile.importZip');
      }, 100);
    },
  };
}

function useRefreshInstance(notify: Notify) {
  const { $t } = useI18n();
  const pinging = ref(false);
  const { refreshServerStatusAll } = useInstances();
  return {
    pinging,
    // options: {
    //   animation: 200,
    //   group: 'description',
    //   disabled: false,
    //   ghostClass: 'ghost',
    // },
    refresh() {
      if (pinging.value) return;
      pinging.value = true;
      refreshServerStatusAll().then(() => {
        notify('success', $t('profile.refreshServers'));
      }, (e) => {
        notify('error', $t('profile.refreshServers'), e);
      }).finally(() => {
        pinging.value = false;
      });
    },
  };
}

function useInstanceCreation() {
  const data = reactive({
    wizard: false,
    creatingServer: false,
    creatingTooltip: false,
  });
  return {
    ...toRefs(data),
    createProfile() {
      data.creatingTooltip = false;
      data.creatingServer = false;
      data.wizard = true;
    },
    createServer() {
      data.creatingTooltip = false;
      data.creatingServer = true;
      data.wizard = true;
    },
  };
}

function useInstanceImport(notify: Notify) {
  const { importInstance } = useInstances();
  const { showOpenDialog } = useNativeDialog();
  const { $t } = useI18n();
  const { importUnknownResource } = useResourceOperation();
  const { importCurseforgeModpack } = useCurseforgeImport();
  return {
    async doImport(fromFolder: boolean, curseforge: boolean) {
      const filters = fromFolder
        ? []
        : [{ extensions: ['zip'], name: 'Zip' }];
      const { filePaths } = await showOpenDialog({
        title: $t('profile.import.title'),
        message: $t('profile.import.description'),
        filters,
        properties: fromFolder ? ['openDirectory'] : ['openFile'],
      });
      if (filePaths && filePaths.length > 0) {
        notify('info', $t('profile.import.start'));
        for (const f of filePaths) {
          if (curseforge) {
            await importUnknownResource({
              path: f,
              type: 'curseforge-modpack',
              background: true,
            });
            await importCurseforgeModpack({ path: f });
          } else {
            await importInstance(f);
          }
        }
        notify('success', $t('profile.import.title'));
      }
    },
  };
}

function useInstancesColor() {
  onMounted(() => {
    // const colors = [...this.colors];
    // const count = colors.length;
    // const newOrder = [];
    // for (let i = 0; i < count; ++i) {
    //   const choise = Math.random() * Math.floor(colors.length);
    //   newOrder.push(colors.splice(choise, 1));
    // }
    // this.colors = newOrder;
  });
}

export default defineComponent({
  components: {
    PreviewCard,
    AddInstanceStepper,
    AddServerStepper,
    DeleteDialog,
  },
  setup() {
    const { mountInstance: selectInstance, deleteInstance, instances } = useInstances();

    const { notify } = useNotifier();
    const { replace } = useRouter();

    const defaultInstance = { path: '', name: '' };
    const { cancel: cancelDelete, operate: doDelete, begin: startDelete, data: deletingInstance } = useOperation(defaultInstance, async (instance) => {
      if (instance && 'path' in instance) {
        await deleteInstance(instance.path).catch(() => {
          notify('error', `Fail to delete profile ${instance.path}`);
        });
      } else {
        notify('error', 'Fail to delete profile');
      }
    });
    const { begin: dragStart, cancel: dragEnd, operate: drop, data: draggingInstance } = useOperation(defaultInstance, (inst) => {
      startDelete(inst);
    });

    const filter = ref('');
    const instancesByTime = useTimeslicedInstances(useFilteredInstances(instances, filter));

    return {
      // drag instance to delete
      draggingInstance,
      dragStart,
      dragEnd,
      onDropDelete: drop,

      // delete instance
      deletingInstance,
      startDelete,
      doDelete,
      cancelDelete,

      // instances display
      instancesByTime,
      filter,
      ...useHoverTexts(),

      // refresh instance operations
      ...useRefreshInstance(notify),

      // instance creation status
      ...useInstanceCreation(),

      ...useInstanceImport(notify),

      selectInstance(id: string) {
        selectInstance(id);
        replace('/');
      },
    };
  },
  methods: {},
});
</script>

<style>
.ghost {
  opacity: 0.5;
}
</style>
