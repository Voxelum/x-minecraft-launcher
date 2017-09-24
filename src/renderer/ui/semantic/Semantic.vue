<template>
    <div class="ui celled grid segment" style="margin:0;">
        <div class="moveable black row">
            <div class="four wide center aligned middle aligned column">
                <h1 class="inverted ui header">
                    ILauncher
                </h1>
            </div>
            <navigation-bar></navigation-bar>
            <div class="one wide center aligned middle aligned column mon-movable" style="cursor:pointer" :style="{grey: closing}" @mouseout="closing = false" @mouseover="closing = true" @click="close">
                <i class="large close icon non-moveable" :class="{red: closing}"></i>
            </div>
        </div>
        <div id="mainRow" class="row" style="height:500px;" :style="{'background-image' : background}">
            <div class="four wide middle aligned center aligned column">
                <h5 id="userDropdown" class="ui pointing dropdown">
                    <i class="user icon"></i>
                    {{username}}
                    <i class="dropdown icon"></i>
                    <div class="menu">
                        <div class="item" @click="showModal('profile')">
                            <i class="id card outline icon"></i> {{$t('user.profile')}}
                        </div>
                        <div class="item" @click="showModal('login')">
                            <i class="sign out icon"></i> {{$t('user.logout')}}
                        </div>
                    </div>
                </h5>
                <skin-view width="210" height="400" :skin="skin"></skin-view>
            </div>
            <div class="twelve wide column">
                <transition name="fade">
                    <router-view></router-view>
                </transition>
            </div>
        </div>
        <div class="moveable black row" style="height:60px">
            <div class="four wide center aligned middle aligned column">
                <div class="ui icon inverted button pointing dropdown non-moveable" @click="showModal('settings')">
                    <i class="setting icon"></i>
                </div>
                <div class="ui icon inverted button non-moveable" @click="refresh">
                    <i class="refresh icon"></i>
                </div>
            </div>
            <div class="twelve wide middle aligned column">
                <span class="non-moveable ui inverted basic icon buttons">
                    <div id="warningPopup" class="ui button">
                        <i class="warning sign icon"></i> {{errorsCount}}
                    </div>
                    <div class="ui flowing popup top left transition hidden">
                        <div v-if="errorsCount != 0" class="ui middle aligned divided list" style="max-height:300px; min-width:300px; overflow:hidden">
                            <div v-for="(moduleErr, index) in errors" :key='moduleErr' class="item">
                                {{index}}
                                <div class="ui middle aligned selection divided list">
                                    <div v-for="err of moduleErr" :key="err" class="item">
                                        <div class="item">
                                            <i class="warning icon"></i> {{err}}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-else>
                            {{$t('errors.empty')}}
                        </div>
                    </div>
                    <div id="taskPopup" class="ui button">
                        <i class="tasks icon"></i> {{tasksCount}}
                    </div>
                    <div class="ui flowing popup top left transition hidden">
                        <div v-if="tasksCount != 0" class="ui middle aligned divided list" style="max-height:300px; min-width:300px; overflow:hidden">
                            <div v-for="(moduleTask, index) in errors" :key='moduleTask' class="item">
                                {{index}}
                                <div class="ui middle aligned selection divided list">
                                    <div v-for="task of moduleTask" :key="task" class="item">
                                        <!-- {{task.name}} -->
                                        <!-- {{task.progress}} -->
                                        <!-- {{task.status}} -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-else>
                            {{$t('errors.empty')}}
                        </div>
                    </div>
                </span>
                <span v-if="!isSelecting">
                    <div class="ui icon right floated  inverted button non-moveable" @click="create('modpack')">
                        <i class="plus icon"></i>
                        {{$t('modpack.add')}}
                    </div>
                    <div class="ui icon right floated  inverted button non-moveable" @click="create('server')">
                        <i class="plus icon"></i>
                        {{$t('server.add')}}
                    </div>
                    <div class="ui icon right floated  inverted button non-moveable" @click="test">
                        <i class="plus icon"></i>
                    </div>
                </span>
                <span v-else>
                    <div class="ui icon right floated inverted button non-moveable" @click="launch">
                        &nbsp&nbsp&nbsp
                        <i class="rocket icon"></i>
                        {{$t('launch')}} &nbsp&nbsp&nbsp&nbsp
                    </div>
                    <div class="ui icon right floated inverted button non-moveable" @click="edit">
                        <i class="edit icon"></i>
                        Edit
                    </div>
                </span>
            </div>
        </div>
        <login-modal ref="loginModal"></login-modal>
        <modpack-modal ref="modpackModal" :defaultAuthor="username" @accept="submitProfile($event, 'modpack')"></modpack-modal>
        <server-modal ref="serverModal" @accept="submitProfile($event, 'server')"></server-modal>
        <delete-modal ref="deleteModal" @accept="deleteProfile"></delete-modal>
        <profile-modal ref="profileModal"></profile-modal>
        <settings-modal ref="settingsModal"></settings-modal>
    </div>
</template>

<script>
import 'static/semantic/semantic.min.css'
import 'static/semantic/semantic.min.js'

import NavigationBar from './components/NavigationBar'
import modals from './components/modals'
import SkinView from '../shared/SkinView'

import { mapMutations, mapState, mapGetters, mapActions } from 'vuex'
export default {
    components: {
        SkinView,
        NavigationBar,
        ...modals
    },
    data() {
        return {
            closing: false,
            view: 'home',
            background: ''//'url(imgs/Background1.png)'
        }
    },
    computed: {
        ...mapGetters('profiles', {
            'selectedProfile': 'selected',
            'selectedProfileID': 'selectedKey'
        }),
        ...mapGetters(['errors', 'tasks', 'errorsCount', 'tasksCount']),
        ...mapGetters('auth', ['username', 'skin']),
        ...mapState('settings', ['autoDownload']),
        isSelecting() {
            return false;//this.selectedProfile != undefined && this.selectedProfileID != null
        },
    },
    mounted(e) {
        if (this.username === '') this.showModal('login')
        const self = this;
        $('#userDropdown').dropdown({
            on: 'hover',
        })
        $('#warningPopup').popup({
            hoverable: true,
            position: 'top left',
            delay: {
                show: 300,
                hide: 800
            },
        })
    },
    methods: {
        ...mapActions('profiles', {
            createProfile: 'createAndSelect',
            selectProfile: 'select',
            deleteProfile: 'delete',
        }),
        ...mapMutations('profiles', ['unselect']),
        ...mapActions(['launch']),
        showModal(id, args) {
            const modal = this.$refs[id + "Modal"]
            if (modal)
                modal.show(args)
            else console.warn(`No modal named ${id}`)
        },
        create(type) {
            this.showModal(type)
        },
        refresh() {
            this.$refs.view.refresh()
        },
        edit() {
            const args = { isEdit: true }
            if (this.selectedProfile.type === 'server') {
                args.host = this.selectedProfile.host;
                args.port = this.selectedProfile.port;
                args.name = this.selectedProfile.name;
            } else {
                args.name = this.selectedProfile.name;
                args.author = this.selectedProfile.author;
                args.description = this.selectedProfile.description;
            }
            this.showModal(this.selectedProfile.type, args)
        },
        close() {
            require('electron').ipcRenderer.sendSync('exit')
        },
        submitProfile(event, type) {
            if (event.isEdit) {
                this.$store.commit(`profiles/${this.selectedProfileID}/putAll`, event)
            } else {
                event.type = type;
                this.createProfile({ type, option: event })
            }
        },
        test() {
            this.$store.dispatch('query', { service: 'jre', action: 'ensureJre' })
        },
        onlaunch() {
            this.launch().catch(e => {
                console.log(e);
            })
        },
    },
}
</script>

<style>
.moveable {
    -webkit-app-region: drag
}

.non-moveable {
    -webkit-app-region: no-drag
}

body ::-webkit-scrollbar {
    width: 2px;
}

::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
}

body ::-webkit-scrollbar-thumb {
    -webkit-border-radius: 5px;
    border-radius: 10px;
    /* width: 1px; */
    background: rgba(0, 0, 0, 0.25);
}

::-webkit-scrollbar-thumb:window-inactive {
    /* background: rgba(0, 0, 0, 0.2); */
}
.fade-enter-active, .fade-leave-active {
  transition: opacity .3s ease;
}
.fade-enter, .fade-leave-active {
  opacity: 0
}
.child-view {
  position: absolute;
  transition: all .3s cubic-bezier(.55,0,.1,1);
}
.slide-left-enter, .slide-right-leave-active {
  opacity: 0;
  -webkit-transform: translate(30px, 0);
  transform: translate(30px, 0);
}
.slide-left-leave-active, .slide-right-enter {
  opacity: 0;
  -webkit-transform: translate(-30px, 0);
  transform: translate(-30px, 0);
}
</style>
