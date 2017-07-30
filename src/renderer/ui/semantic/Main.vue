<template>
    <div class="ui celled grid segment" style="margin:0;">
        <div class="moveable black row">
            <div class="four wide center aligned column">
                <h1 class="inverted ui header">
                    ILauncher
                </h1>
            </div>
            <div class="ten wide column">
                <div class="ui breadcrumb">
                    <a class="section">
                        <div class="ui inverted circular button non-moveable" @click="unselect">Home</div>
                    </a>
                    <span v-if="selecting">
                        <i class="right chevron inverted icon divider" style="color:white"></i>
                        <a class="section">
                            <div class="ui inverted circular button non-moveable">{{selectedProfile.name}}</div>
                        </a>
                    </span>
                </div>
            </div>
            <div class="two wide center aligned column">
                <button class="ui inverted circular button non-moveable" @click="showLogin">{{playerName}}</button>
            </div>
        </div>
        <div class="row" style="height:500px;">
            <div class="four wide middle aligned center aligned column">
                <div class="ui header segment">{{playerName}}</div>
                <!-- <skin-view width="1200" height="400"></skin-view> -->
            </div>
            <div class="twelve wide column">
                <div v-if="selecting">
                    <profile-view :source='selectedProfile' :id="selectProfileID"></profile-view>
                </div>
                <div v-else>
                    <div class="ui link cards">
                        <profile-card class="profile" v-for="id in keys" :key="id" :id="id" :source='getByKey(id)' @select="selectProfile" @delete="showModal('delete', { type: $event.source.type, id: $event.id })"></profile-card>
                    </div>
                </div>
            </div>
        </div>
        <div class="moveable black row" style="height:60px">
            <div class="four wide center aligned column">
                <div class="ui icon inverted button non-moveable">
                    <i class="setting icon"></i>
                </div>
            </div>
            <div class="twelve wide column">
                <div v-if="selecting">
                    <div class="ui fluid inverted button non-moveable" @click="launch">Launch</div>
                </div>
                <div v-else>
                    <div class="ui icon right floated circlar inverted button non-moveable" @click="showModal('profile')">
                        <i class="plus icon"></i>
                        {{$t('profile.add.modpack')}}
                    </div>
                    <div class="ui icon right floated circlar inverted button non-moveable" @click="showModal('server')">
                        <i class="plus icon"></i>
                        {{$t('profile.add.server')}}
                    </div>
                </div>
            </div>
        </div>
        <div id="login" class="ui basic modal" style="padding:0 20% 0 20%;">
            <i class="close icon" v-if="this.$store.state.auth.authInfo !== undefined"></i>
            <login @logined='onlogined'></login>
        </div>
        <profile-modal ref="profileModal" @accept="createProfile({ type: 'modpack', option: $event })"></profile-modal>
        <server-modal ref="serverModal" @accept="createProfile({ type: 'server', option: $event })"></server-modal>
        <delete-modal ref="deleteModal" @accept="deleteProfile"></delete-modal>
    </div>
</template>

<script>
require('static/semantic/dist/semantic.min.css')
require('static/semantic/dist/semantic.min.js')
import ProfileCard from './components/ProfileCard'
import ProfileView from './components/ProfileView'
import SkinView from './components/SkinView'
import Login from './components/Login'
import ProfileModal from './components/ProfileModal'
import ServerModal from './components/ServerModal'
import DeleteModal from './components/DeleteModal'

import { mapMutations, mapState, mapActions, mapGetters } from 'vuex'

export default {
    components: { ProfileCard, ProfileView, SkinView, Login, ServerModal, ProfileModal, DeleteModal },
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
            createProfile: 'createAndSelect',
            selectProfile: 'select',
            deleteProfile: 'delete',
        }),
        ...mapActions(['launch']),
        ...mapMutations('profiles', {
            unselect: 'unselect',
        }),
        showModal(id, args) {
            this.$refs[id + "Modal"].show(args)
        },
        showLogin() {
            this.$nextTick(() => {
                $('#login')
                    .modal('setting', 'closable', false)
                    .modal('refresh')
                    .modal('setting', 'observeChanges', true)
                    .modal({ blurring: true })
                    .modal('show')
            })
        },
        onlogined() {
            this.$nextTick(() => {
                $('#login').modal('hide')
            })
        },
    },
}
</script>

<style scoped>
.moveable {
    -webkit-app-region: drag
}

.non-moveable {
    -webkit-app-region: no-drag
}
</style>