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
        <div class="row" style="height:500px;" :style="{'background-image' : background}">
            <div class="four wide middle aligned center aligned column">
                <h5 ref="userDropdown" class="ui pointing dropdown">
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
                    <router-view ref="view"></router-view>
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
                    <div ref="warningPopup" class="ui button">
                        <i class="warning sign icon"></i> {{errorsCount}}
                    </div>
                    <div class="ui flowing popup top left transition hidden">
                        <div v-if="errorsCount != 0" class="ui middle aligned divided list" style="max-height:300px; min-width:300px; overflow:hidden">
                            <div v-for="(moduleErr, index) in errors" :key='index' class="item">
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
                    <div ref="taskPopup" class="ui button">
                        <i class="tasks icon"></i> {{tasksCount}}
                    </div>
                    <div class="ui flowing popup top left transition hidden">
                        <div v-if="tasksCount != 0" class="ui middle aligned divided list" style="max-height:300px; min-width:300px; overflow:hidden">
                            <div v-for="(moduleTask, index) in errors" :key='index' class="item">
                                {{index}}
                                <div class="ui middle aligned selection divided list">
                                    <div v-for="(task, index) of moduleTask" :key="index" class="item">
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
                <router-view name='buttons' @modal="showModal" :id="selectedProfileID"></router-view>
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
import vue from 'vue'
import draggable from 'vuedraggable'

import 'static/semantic/semantic.min.css'
import 'static/semantic/semantic.min.js'

import Pagination from './components/Pagination'
import TextComponent from './components/TextComponent'

import NavigationBar from './components/NavigationBar'
import modals from './components/modals'
import SkinView from '../shared/SkinView'

import { mapMutations, mapState, mapGetters, mapActions } from 'vuex'

vue.component('pagination', Pagination);
vue.component('text-component', TextComponent)
vue.component('draggable', draggable)

export default {
    components: {
        SkinView,
        NavigationBar,
        ...modals
    },
    data() {
        return {
            closing: false,
            background: ''//'url(imgs/Background1.png)'
        }
    },
    computed: {
        ...mapGetters('profiles', {
            'selectedProfile': 'selected',
            'selectedProfileID': 'selectedKey'
        }),
        ...mapGetters(['errors', 'runningTasks', 'errorsCount', 'tasksCount']),
        ...mapGetters('auth', ['username', 'skin']),
    },
    mounted(e) {
        if (this.username === '') this.showModal('login')
        $(this.$refs.userDropdown).dropdown({ on: 'hover' })
        $(this.$refs.warningPopup).popup({
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
        showModal(id, args) {
            const modal = this.$refs[id + "Modal"]
            if (modal)
                modal.show(args)
            else console.warn(`No modal named ${id}`)
        },
        refresh() {
            this.$refs.view.refresh()
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
    },
}
</script>

<style>
body {
    background-color: transparent;
}

.acrylic {
    /* padding: 4em 6em; */
    position: relative;
    overflow: hidden;
}

.acrylic::before {
    filter: blur(10px);
    content: "";
    position: absolute;
    left: -10px;
    top: -10px;
    width: calc(100% + 20px);
    height: calc(100% + 20px);
    z-index: -1;
}

.acrylic::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    opacity: 0.35;
    border: 1px solid #fff;
    /* background-image: url(data:image/png;base64,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); */
}

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

.fade-enter-active,
.fade-leave-active {
    transition: opacity .3s ease;
}

.fade-enter,
.fade-leave-active {
    opacity: 0
}

.child-view {
    position: absolute;
    transition: all .3s cubic-bezier(.55, 0, .1, 1);
}

.slide-left-enter,
.slide-right-leave-active {
    opacity: 0;
    -webkit-transform: translate(30px, 0);
    transform: translate(30px, 0);
}

.slide-left-leave-active,
.slide-right-enter {
    opacity: 0;
    -webkit-transform: translate(-30px, 0);
    transform: translate(-30px, 0);
}
</style>
