<template>
    <div>
        <mu-appbar title="Main" :zDepth="0" class="Appbar moveAble" :class="{'nav-hide': !openNav}">
            <mu-icon-button @click="toggleNav" class="notMoveAble" icon="menu" slot="left"/>
            <mu-icon-button class="notMoveAble" icon="clear" slot="right"/>
        </mu-appbar>
        <mu-drawer :open="openNav" :docked="docked" :overlay="docked" class="app-drawer" :zDepth="1">
            <mu-appbar :zDepth="0" title="ILauncher">
            </mu-appbar>
        </mu-drawer>
    </div>
</template>
<script>
    require("muse-ui/dist/muse-ui.css")
    require("muse-ui/dist/muse-ui.js")
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
        }
    }
</script>

<style scoped>
    .moveAble {
        -webkit-app-region: drag;
    }
    .notMoveAble {
        -webkit-app-region: no-drag
    }
    .Appbar{
        position: fixed;
        left: 256px;
        right: 0;
        top: 0;
        width: auto;
        -webkit-transition: all .45s cubic-bezier(.23,1,.32,1);
        transition: all .45s cubic-bezier(.23,1,.32,1)
    }
    .Appbar.nav-hide {
        left: 0
    }

</style>