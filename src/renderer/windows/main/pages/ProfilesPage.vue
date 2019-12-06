<template>
  <v-container grid-list-md text-xs-center style="padding-left: 30px; padding-right: 30px">
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
                    <v-icon v-if="!dragging" key="a" dark style="font-size: 28px; transition: all 0.2s ease;">
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
                <v-btn flat fab dark small style="margin-left: 5px; margin-top: 5px;" @click="doImport(false)"
                       v-on="on">
                  <v-icon dark style="font-size: 28px">
                    save_alt
                  </v-icon>
                </v-btn>
              </template>
              <v-btn style="z-index: 20;" fab small v-on="on" @click="doImport(true)" @mouseenter="enterImport($t('profile.importFolder'))"
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
      <v-flex v-if="timesliceProfiles[0].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.today') }}
      </v-flex>
      <v-flex v-for="profile in timesliceProfiles[0]" :key="profile.id" xs6
              @dragstart="dragging=true; draggingProfile=profile" @dragend="dragging=false; draggingProfile={}">
        <card-profile-preview :profile="profile" @click.stop="selectProfile(profile.id)" />
      </v-flex>
      <v-flex v-if="timesliceProfiles[1].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.threeDay') }}
      </v-flex>
      <v-flex v-for="profile in timesliceProfiles[1]" :key="profile.id" xs6
              @dragstart="dragging=true; draggingProfile=profile" @dragend="dragging=false; draggingProfile={}">
        <card-profile-preview :profile="profile" @click.stop="selectProfile(profile.id)" />
      </v-flex>
      <v-flex v-if="timesliceProfiles[2].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.older') }}
      </v-flex>
      <v-flex v-for="profile in timesliceProfiles[2]" :key="profile.id" xs6 
              @dragstart="dragging=true; draggingProfile=profile" @dragend="dragging=false; draggingProfile={}">
        <card-profile-preview :profile="profile" @click.stop="selectProfile(profile.id)" />
      </v-flex>
    </v-layout>
    
    <v-dialog v-model="isDeletingProfile" width="400">
      <v-card>
        <v-card-title>
          <h2>
            {{ $t('profile.delete') }}
          </h2>
        </v-card-title>
        <v-card-text>
          {{ $t('profile.deleteHint', { name: deletingProfile.name, id: deletingProfile.id }) }}
        </v-card-text>
        <v-card-actions>
          <v-btn flat @click="cancelDelete">
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn flat color="red" @click="doDelete">
            <v-icon left>
              delete
            </v-icon> {{ $t('delete.yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="wizard" persistent>
      <stepper-add-profile v-if="!creatingServer" :show="wizard" @quit="wizard=false" />
      <stepper-add-server v-else :show="wizard" @quit="wizard=false" />
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { reactive, toRefs, computed, onMounted } from '@vue/composition-api';
import {
  useI18n,
  useNativeDialog,
  useNotifier,
  useRouter,
  useInstances,
  useResourceOperation,
  useCurseforgeImport,
} from '@/hooks';
import { ProfileConfig } from 'universal/store/modules/profile.config';

export default {
  setup() {
    const { t } = useI18n();
    const { showOpenDialog } = useNativeDialog();
    const { selectInstance, deleteInstance, pingProfiles, instances, importInstance } = useInstances();
    const { importResource } = useResourceOperation();
    const { importCurseforgeModpack } = useCurseforgeImport();
    const { notify } = useNotifier();
    const router = useRouter();
    const data: {
      filter: string;
      wizard: boolean;
      hoverTextOnCreate: string;
      hoverTextOnImport: string;
      creatingServer: boolean;
      creatingTooltip: boolean;
      isDeletingProfile: boolean;
      deletingProfile: ProfileConfig | {};
      dragging: boolean;
      draggingProfile: ProfileConfig | {};
      pinging: boolean;
    } = reactive({
      filter: '',
      wizard: false,
      hoverTextOnCreate: t('profile.add'),
      hoverTextOnImport: t('profile.importZip'),
      creatingServer: false,
      creatingTooltip: false,

      isDeletingProfile: false,
      deletingProfile: {},

      /**
       * Is dragging a profile
       */
      dragging: false,
      draggingProfile: { },

      pinging: false,
    });
    const timesliceProfiles = computed(() => {
      const filter = data.filter.toLowerCase();
      const filtered = instances.filter(
        profile => filter === ''
          || ('author' in profile
            ? profile.author.toLowerCase().indexOf(filter) !== -1
            : false)
          || profile.name.toLowerCase().indexOf(filter) !== -1
          || ('description' in profile
            ? profile.description.toLowerCase().indexOf(filter) !== -1
            : false),
      );

      const today = Math.floor(Date.now() / 1000 / 60 / 60 / 24) * 1000 * 60 * 60 * 24;
      const threeDays = (Math.floor(Date.now() / 1000 / 60 / 60 / 24) - 3)
        * 1000
        * 60
        * 60
        * 24;
      const todayR = [];
      const threeR = [];
      const other = [];
      for (const p of filtered) {
        if (p.lastAccessDate > today) {
          todayR.push(p);
        } else if (p.lastAccessDate > threeDays) {
          threeR.push(p);
        } else {
          other.push(p);
        }
      }
      return [todayR, threeR, other];
    });
    function startDelete(prof: ProfileConfig) {
      data.isDeletingProfile = true;
      data.deletingProfile = prof;
    }
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
    return {
      ...toRefs(data),
      timesliceProfiles,
      options: {
        animation: 200,
        group: 'description',
        disabled: false,
        ghostClass: 'ghost',
      },
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
      onDropDelete() {
        startDelete(data.draggingProfile as ProfileConfig);
      },
      async doImport(fromFolder: boolean, curseforge: boolean) {
        const filters = fromFolder
          ? []
          : [{ extensions: ['zip'], name: 'Zip' }];
        const { filePaths } = await showOpenDialog({
          title: t('profile.import.title'),
          message: t('profile.import.description'),
          filters,
          properties: fromFolder ? ['openDirectory'] : ['openFile'],
        });
        if (filePaths && filePaths.length > 0) {
          for (const f of filePaths) {
            if (curseforge) {
              await importResource({
                path: f,
                type: 'curseforge-modpack',
                background: true,
              });
              await importCurseforgeModpack({ path: f });
            } else {
              await importInstance(f);
            }
          }
        }
      },
      doDelete() {
        if ('id' in data.deletingProfile) {
          deleteInstance(data.deletingProfile.id).finally(() => {
            data.isDeletingProfile = false;
          });
        } else {
          data.isDeletingProfile = false;
        }
      },
      cancelDelete() {
        data.isDeletingProfile = false;
        data.deletingProfile = {};
      },
      selectProfile(id: string) {
        selectInstance(id);
        router.replace('/');
      },
      enterAltCreate() {
        setTimeout(() => {
          data.hoverTextOnCreate = t('profile.addServer');
        }, 100);
      },
      leaveAltCreate() {
        setTimeout(() => {
          data.hoverTextOnCreate = t('profile.add');
        }, 100);
      },
      enterImport(text: string) {
        setTimeout(() => {
          data.hoverTextOnImport = text;
        }, 100);
      },
      leaveImport() {
        setTimeout(() => {
          data.hoverTextOnImport = t('profile.importZip');
        }, 100);
      },
      refresh() {
        if (data.pinging) return;
        data.pinging = true;
        pingProfiles().then(() => {
          notify('success', t('profile.refreshServers'));
        }, (e) => {
          notify('error', t('profile.refreshServers'), e);
        }).finally(() => {
          data.pinging = false;
        });
      },
      // colors: ['blue-grey', 'red', 'pink',
      //   'purple', 'green', 'yellow', 'amber',
      //   'orange', 'deep-orange', 'brown'],
    };
  },
  methods: {},
};
</script>

<style>
.ghost {
  opacity: 0.5;
}
</style>
