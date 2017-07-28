<template>
    <div id="main">
        <mu-appbar title="Main" :zDepth="0" class="Appbar moveAble" :class="{'nav-hide': !openNav}">
            <mu-icon-button @click="toggleNav" class="notMoveAble" icon="menu" slot="left" />
            <mu-icon-button class="notMoveAble" icon="clear" slot="right" />
        </mu-appbar>
        <mu-drawer :open="openNav" :docked="docked" :overlay="docked" class="app-drawer" :zDepth="1">
            <mu-appbar :zDepth="0" title="ILauncher">
            </mu-appbar>
        </mu-drawer>
        <Login></Login>
    </div>
</template>

<script>
import Vue from 'vue'
import Vuetify from 'vuetify'
import MuseUI from 'muse-ui';
Vue.use(Vuetify);
Vue.use(MuseUI);

require("muse-ui/dist/muse-ui.css")
require("muse-ui/dist/muse-ui.js")
import Login from './components/Login'
export default {
    data() {
        return {
            openNav: true,
            docked: true
        }
    },
    methods: {
        toggleNav() {
            this.openNav = !this.openNav;
        }
    },
    components: { Login }
}
</script>

<style scoped>
.moveAble {
    -webkit-app-region: drag;
}

.notMoveAble {
    -webkit-app-region: no-drag
}

.Appbar {
    position: fixed;
    left: 256px;
    right: 0;
    top: 0;
    width: auto;
    -webkit-transition: all .45s cubic-bezier(.23, 1, .32, 1);
    transition: all .45s cubic-bezier(.23, 1, .32, 1)
}

.Appbar.nav-hide {
    left: 0
}
</style>

<style>
html {
    font-family: Microsoft YaHei;
}
</style>

<style lang="stylus">
    @import '../assets/main'
</style>
