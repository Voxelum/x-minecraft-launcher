<template>
    <div class="ui celled grid">
        <div class="black row moveable">
            <div class="black four wide middle aligned center aligned column">
                <h2 class="inverted ui header">
                    ILauncher
                </h2>
            </div>
            <div class="ten wide column">
                <div class="ui breadcrumb">
                    <a class="section">
                        <button class="ui inverted circular button" @click="unselect">Home</button>
                    </a>
                    <span v-if="selecting">
                        <i class="right chevron inverted icon divider" style="color:white"></i>
                        <a class="section">
                            <button class="ui inverted circular button">{{selectedProfile.name}}</button>
                        </a>
                    </span>
                </div>
            </div>
            <div class="two wide center aligned column">
                <button class="ui inverted circular button" @click="showLogin">{{playerName}}</button>
            </div>
        </div>
        <div class="row">
            <div class="four wide middle aligned center aligned column">
                <div class="ui header segment">{{playerName}}</div>
                <!-- <skin-view width="1200" height="400"></skin-view> -->
                <div class="ui segment">
                    <button class="ui icon button">
                        <i class="setting icon"></i>
                    </button>
                </div>
            </div>
            <div class="twelve wide column">
                <div v-if="selecting">
                    <profile-view :source='selectedProfile' :id="selectProfileID"></profile-view>
                </div>
                <div v-else>
                    <div class="ui link cards">
                        <profile-card class="profile" v-for="id in keys" :key="id" :id="id" :source='getByKey(id)' @select="selectProfile"></profile-card>
                    </div>
                    <button id="addElement" class="ui icon right floated circlar button" @click="oncreate">
                        <i class="plus icon"></i>
                    </button>
                </div>
            </div>
        </div>
        <div id="login" class="ui basic modal" style="padding:0 20% 0 20%;">
            <i class="close icon" v-if="this.$store.state.auth.authInfo !== undefined"></i>
            <login @logined='onlogined'></login>
        </div>
    </div>
</template>

<script>
require('static/semantic/dist/semantic.min.css')
require('static/semantic/dist/semantic.min.js')
import ProfileCard from './components/ProfileCard'
import ProfileView from './components/ProfileView'
import SkinView from './components/SkinView'
import Login from './components/Login'

import { mapMutations, mapState, mapActions, mapGetters } from 'vuex'

export default {
    computed: {
        selecting() {
            return this.selectProfileID != undefined && this.selectProfileID != '' && this.selectProfileID != null
        },
        ...mapGetters('profiles', {
            'selectedProfile': 'selected',
            'profiles': 'allStates',
            'keys': 'allKeys',
            'getByKey': 'getByKey',
            'selectProfileID': 'selectedKey'
        }),
        playerName() {
            return this.$store.state.auth.authInfo ? this.$store.state.auth.authInfo.selectedProfile.name : 'Steve';
        },
    },
    mounted(e) {
        if (this.playerName === 'Steve') this.showLogin()
    },
    methods: {
        ...mapActions('profiles', {
            createProfile: 'create'
        }),
        ...mapMutations('profiles', {
            selectProfile: 'select',
            unselect: 'unselect'
        }),
        showLogin() {
            this.$nextTick(() => {
                $('#login').modal('setting', 'closable', false).modal('refresh').modal('setting', 'observeChanges', true).modal('show')
            })
        },
        onlogined() {
            this.$nextTick(() => {
                $('#login').modal('hide')
            })
        },
        oncreate(event) {
            this.createProfile({ type: 'modpack', option: { author: this.playerName } }).then(id => {
                this.selectProfile(id)
            })
        },
    },
    components: { ProfileCard, ProfileView, SkinView, Login }
}
</script>

<style scoped>
.moveable {
    /* -webkit-app-region: drag */
}
</style>