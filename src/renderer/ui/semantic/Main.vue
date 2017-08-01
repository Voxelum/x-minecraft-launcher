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
                    <span v-if="isSelecting">
                        <i class="right chevron inverted icon divider" style="color:white"></i>
                        <a class="section">
                            <div class="ui inverted circular button non-moveable">
                                {{selectedProfile.name}}
                            </div>
                        </a>
                    </span>
                </div>
            </div>
            <div class="two wide center aligned column">
                <div class="ui inverted circular button non-moveable">
                    <i class="user icon"></i>{{username}}</div>
            </div>
        </div>
        <div class="row" style="height:500px;">
            <div class="four wide middle aligned center aligned column">
                <!-- <skin-view width="1200" height="400"></skin-view>  -->
            </div>
            <div class="twelve wide column">
                <card-view ref='view' v-if="!isSelecting" @select="selectProfile" @delete="showModal('delete', { type: $event.source.type, id: $event.id })"></card-view>
                <server-view ref='view' :id="selectedProfileID" :source="selectedProfile" v-else-if="selectedProfile.type==='server'"> </server-view>
                <profile-view ref='view' :id="selectedProfileID" :source="selectedProfile" v-else> </profile-view>
            </div>
        </div>
        <div class="moveable black row" style="height:60px">
            <div class="four wide center aligned column">
                <div class="ui icon inverted button non-moveable">
                    <i class="setting icon"></i>
                </div>
            </div>
            <div class="twelve wide column">
                <div class="ui icon circlar inverted button non-moveable" @click="refresh">
                    <i class="refresh icon"></i>
                </div>
                <i class="warning sign icon"></i> 0
                <span style="padding:3px"></span>
                <i class="cloud download icon"></i> 0
                <i class="tasks icon"></i> 0
                <span v-if="!isSelecting">
                    <div class="ui icon right floated circlar inverted button non-moveable" @click="create('profile')">
                        <i class="plus icon"></i>
                        {{$t('profile.add.modpack')}}
                    </div>
                    <div class="ui icon right floated circlar inverted button non-moveable" @click="create('server')">
                        <i class="plus icon"></i>
                        {{$t('profile.add.server')}}
                    </div>
                </span>
                <span v-else>
                    <div class="ui icon right floated circlar inverted button non-moveable" @click="launch">
                        <i class="rocket icon"></i>
                        {{$t('launch')}}
                    </div>
                </span>
            </div>
        </div>
        <login-modal ref="loginModal"></login-modal>
        <profile-modal ref="profileModal" :defaultAuthor="username" @accept="createProfile({ type: 'modpack', option: $event })"></profile-modal>
        <server-modal ref="serverModal" @accept="createProfile({ type: 'server', option: $event })"></server-modal>
        <delete-modal ref="deleteModal" @accept="deleteProfile"></delete-modal>
    </div>
</template>

<script>
require('static/semantic/dist/semantic.min.css')
require('static/semantic/dist/semantic.min.js')

import ProfileView from './components/profiles/ProfileView'
import ServerView from './components/profiles/ServerView'

import CardView from './components/CardView'

import SkinView from './components/SkinView'

import LoginModal from './components/modals/LoginModal'
import ProfileModal from './components/modals/ProfileModal'
import ServerModal from './components/modals/ServerModal'
import DeleteModal from './components/modals/DeleteModal'

import { mapMutations, mapState, mapActions, mapGetters } from 'vuex'

export default {
    components: {
        ProfileView, ServerView, SkinView, CardView,
        LoginModal, ServerModal, ProfileModal, DeleteModal,
    },
    computed: {
        ...mapGetters('profiles', {
            'selectedProfile': 'selected',
            'selectedProfileID': 'selectedKey'
        }),
        isSelecting() {
            return this.selectedProfileID != undefined && this.selectedProfileID != '' && this.selectedProfileID != null
        },
        username() {
            return this.$store.state.auth.authInfo ? this.$store.state.auth.authInfo.selectedProfile.name : 'Steve';
        },
        canLaunch() {
            return this.$store.getters[`profiles/${this.selectedProfileID}/canLaunch`]
        }
    },
    mounted(e) {
        if (this.username === 'Steve') this.showLogin()
        console.log(this.$store.getters['profiles/errors'])
    },
    methods: {
        ...mapActions('profiles', {
            createProfile: 'createAndSelect',
            selectProfile: 'select',
            deleteProfile: 'delete',
        }),
        ...mapActions(['launch']),
        ...mapMutations('profiles', ['unselect']),
        showModal(id, args) {
            this.$refs[id + "Modal"].show(args)
        },
        showLogin() {
            this.showModal('login')
        },
        create(type) {
            this.showModal(type)
        },
        refresh() {
            this.$refs.view.refresh()
        }
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
</style>