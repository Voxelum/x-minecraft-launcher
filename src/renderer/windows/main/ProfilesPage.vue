<template>
  <v-container grid-list-md text-xs-center style="padding-left: 30px; padding-right: 30px">
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
                            @drop="onDropDelete" @dragover="$event.preventDefault()">
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
        <card-profile-preview :profile="profile" @click="selectProfile($event, profile.id)" />
      </v-flex>
      <v-flex v-if="timesliceProfiles[1].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.threeDay') }}
      </v-flex>
      <v-flex v-for="profile in timesliceProfiles[1]" :key="profile.id" xs6
              @dragstart="dragging=true; draggingProfile=profile" @dragend="dragging=false; draggingProfile={}">
        <card-profile-preview :profile="profile" @click="selectProfile($event, profile.id)" />
      </v-flex>
      <v-flex v-if="timesliceProfiles[2].length !== 0" style="color: grey" xs12> 
        {{ $t('profile.older') }}
      </v-flex>
      <v-flex v-for="profile in timesliceProfiles[2]" :key="profile.id" xs6 
              @dragstart="dragging=true; draggingProfile=profile" @dragend="dragging=false; draggingProfile={}">
        <card-profile-preview :profile="profile" @click="selectProfile($event, profile.id)" />
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
      <add-profile-wizard v-if="!creatingServer" :show="wizard" @quit="wizard=false" />
      <add-server-wizard v-else :show="wizard" @quit="wizard=false" />
    </v-dialog>
  </v-container>
</template>

<script>

export default {
  data() {
    return {
      filter: '',
      wizard: false,
      hoverTextOnCreate: this.$t('profile.add'),
      hoverTextOnImport: this.$t('profile.importZip'),
      creatingServer: false,
      creatingTooltip: false,
      isDeletingProfile: false,
      deletingProfile: {},

      dragging: false,
      draggingProfile: {},

      colors: ['blue-grey', 'red', 'pink',
        'purple', 'green', 'yellow', 'amber',
        'orange', 'deep-orange', 'brown'],

      options: {
        animation: 200,
        group: 'description',
        disabled: false,
        ghostClass: 'ghost',
      },
    };
  },
  computed: {
    timesliceProfiles() {
      const filter = this.filter.toLowerCase();
      const profiles = this.$repo.getters.profiles.filter(profile => filter === ''
        || (profile.author ? profile.author.toLowerCase().indexOf(filter) !== -1 : false)
        || profile.name.toLowerCase().indexOf(filter) !== -1
        || (profile.description ? profile.description.toLowerCase().indexOf(filter) !== -1 : false));

      const today = Math.floor(Date.now() / 1000 / 60 / 60 / 24) * 1000 * 60 * 60 * 24;
      const threeDays = (Math.floor(Date.now() / 1000 / 60 / 60 / 24) - 3) * 1000 * 60 * 60 * 24;
      const todayR = [];
      const threeR = [];
      const other = [];
      for (const p of profiles) {
        if (p.lastAccessDate > today) {
          todayR.push(p);
        } else if (p.lastAccessDate > threeDays) {
          threeR.push(p);
        } else {
          other.push(p);
        }
      }
      return [todayR, threeR, other];
    },
    profiles: {
      get() {
        const filter = this.filter.toLowerCase();
        return this.$repo.getters.profiles.filter(profile => filter === ''
          || profile.author.toLowerCase().indexOf(filter) !== -1
          || profile.name.toLowerCase().indexOf(filter) !== -1
          || profile.description.toLowerCase().indexOf(filter) !== -1);
      },
      set(v) {
        this.$repo.commit('profileIds', v.map(p => p.id));
      },
    },
  },
  mounted() {
    const colors = [...this.colors];
    const count = colors.length;
    const newOrder = [];
    for (let i = 0; i < count; ++i) {
      const choise = Math.random() * Math.floor(colors.length);
      newOrder.push(colors.splice(choise, 1));
    }
    this.colors = newOrder;
  },
  methods: {
    createProfile() {
      this.creatingTooltip = false;
      this.creatingServer = false;
      this.wizard = true;
    },
    createServer() {
      this.creatingTooltip = false;
      this.creatingServer = true;
      this.wizard = true;
    },
    onDropDelete() {
      this.startDelete(this.draggingProfile);
    },
    doImport(fromFolder, curseforge) {
      const filters = fromFolder ? [] : [{ extensions: ['zip'], name: 'Zip' }];
      const properties = fromFolder ? ['openDirectory'] : ['openFile'];
      this.$electron.remote.dialog.showOpenDialog({
        title: this.$t('profile.import.title'),
        description: this.$t('profile.import.description'),
        filters,
        properties,
      }, (filenames, bookmarks) => {
        console.log(filenames);
        if (filenames && filenames.length > 0) {
          for (const f of filenames) {
            if (curseforge) {
              this.$repo.dispatch('importCurseforgeModpack', f);
            } else {
              this.$repo.dispatch('importProfile', f);
            }
          }
        }
      });
    },
    doDelete() {
      if (this.deletingProfile) {
        this.$repo.dispatch('deleteProfile', this.deletingProfile.id)
          .finally(() => {
            this.isDeletingProfile = false;
          });
      } else {
            this.isDeletingProfile = false;
      }
    },
    cancelDelete() {
      this.isDeletingProfile = false;
      this.deletingProfile = {};
    },
    startDelete(prof) {
      this.isDeletingProfile = true;
      this.deletingProfile = prof;
    },
    doCopy(id) {
    },
    onProfileMove(e) {
      if (this.filter.length !== 0) {
        console.log('cancelled');
        return false;
      }
      return true;
    },
    selectProfile(event, id) {
      this.$repo.commit('selectProfile', id);
      this.$router.replace('/');

      event.stopPropagation();
      return true;
    },
    enterAltCreate() {
      setTimeout(() => {
        this.hoverTextOnCreate = this.$t('profile.addServer');
      }, 100);
    },
    leaveAltCreate() {
      setTimeout(() => {
        this.hoverTextOnCreate = this.$t('profile.add');
      }, 100);
    },
    enterImport(text) {
      setTimeout(() => {
        this.hoverTextOnImport = text;
      }, 100);
    },
    leaveImport() {
      setTimeout(() => {
        this.hoverTextOnImport = this.$t('profile.importZip');
      }, 100);
    },
  },
};
</script>

<style>
.ghost {
  opacity: 0.5;
}
</style>
