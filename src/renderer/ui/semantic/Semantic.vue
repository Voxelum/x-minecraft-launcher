<template>
    <div class="ui celled grid segment" style="margin:0; background-color: #f7f7f7;" @click="hidePopup" @contextmenu="showPopup">
        <div class="top-bar moveable black row" style="">
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
                <user-dropdown></user-dropdown>
                <skin-view width="210" height="400" :skin="skin"></skin-view>
            </div>
            <div class="twelve wide column" style="min-height:500px; min-height:500px; overflow-x:hidden; overflow-y:hidden;">
                <transition name="fade" mode="out-in">
                    <router-view></router-view>
                </transition>
            </div>
        </div>
        <div class="border-bar moveable black row" style="height:60px;">
            <div class="four wide center aligned middle aligned column">
                <div class="ui icon inverted button pointing dropdown non-moveable" @click="showModal('settings')">
                    <i class="setting icon"></i>
                </div>
                <div class="ui icon inverted button non-moveable" @click="refresh">
                    <i class="refresh icon"></i>
                </div>
            </div>
            <div class="twelve wide middle aligned column">
                <info-popups></info-popups>
                <router-view name='buttons'></router-view>
            </div>
        </div>
        <modals ref='modals'></modals>
        <context-menu ref="contextMenu" :items="contextMenu"></context-menu>
    </div>
</template>

<script>
import vue from 'vue'

import 'static/semantic/semantic.css'
import 'static/semantic/semantic.js'
import { ipcRenderer } from 'electron'

import { mapMutations, mapState, mapGetters, mapActions } from 'vuex'

vue.component('pagination', () => import('./components/Pagination'));
vue.component('context-menu', () => import('./components/ContextMenu'));
vue.component('text-component', () => import('./components/TextComponent'))
vue.component('draggable', () => import('vuedraggable'))
vue.component('div-header', () => import('./components/DivHeader'))
vue.component('progress-bar', () => import('./components/ProgressBar'))
vue.component('undetermined-progress', () => import('./components/UndeterminedProgress'))
vue.component('labeled-input', () => import('./components/LabeledInput'))

export default {
    components: {
        SkinView: () => import('../shared/SkinView'),
        NavigationBar: () => import('./components/common/NavigationBar'),
        Modals: () => import('./components/modals'),
        InfoPopups: () => import('./components/common/InfoPopups'),
        UserDropdown: () => import('./components/common/UserDropdown'),
    },
    data: () => ({
        closing: false,
        contextMenu: [],
        showingContextMenu: false,
        background: ''//'url(imgs/Background1.png)'
    }),
    computed: {
        ...mapGetters('user', ['skin']),
    },
    mounted() {
        ipcRenderer.on('contextMenu', (event) => {
            this.contextMenu = event;
            this.showingContextMenu = true;
        })
    },
    methods: {
        showModal(id, args) { this.$ipc.emit('modal', id, args) },
        refresh() { this.$store.dispatch('refresh$'); },
        close: () => require('electron').ipcRenderer.sendSync('exit'),
        hidePopup() {
            this.$refs.contextMenu.hide();
        },
        showPopup(event) {

            console.log();

            if (this.showingContextMenu) {
                this.$refs.contextMenu.show(event.clientX, event.clientY);
                this.showingContextMenu = false;
            }
        },
    },
}
</script>

<style>
.app {
  /* border-radius: 7px; */
}
body {
  background-color: transparent;
  /* border-radius: 7px; */
}

.top-bar {
  /* border-radius: 7px 7px 0 0; */
}
.bottom-bar {
  /* border-radius: 0 0 7px 7px; */
}

.moveable {
  -webkit-app-region: drag;
}

.non-moveable {
  -webkit-app-region: no-drag;
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
  transition: opacity 0.25s ease;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.child-view {
  position: absolute;
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
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
