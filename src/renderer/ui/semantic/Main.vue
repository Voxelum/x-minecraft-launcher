<template>
    <div class="ui celled grid segment" style="margin:0;">
        <div class="moveable black row">
            <div class="four wide center aligned middle aligned column">
                <h1 class="inverted ui header">
                    ILauncher
                </h1>
            </div>
            <div class="ten wide column ">
                <div class="ui breadcrumb">
                    <a class="section">
                        <div class="ui inverted circular button non-moveable" @click="unselect">Home</div>
                    </a>
                    <span v-if="isSelecting">
                        <i class="right chevron inverted icon divider" style="color:white"></i>
                        <a class="section">
                            <div class="ui inverted circular  button non-moveable">
                                {{selectedProfile.name}}
                            </div>
                        </a>
                    </span>
                </div>
                <div class="ui inverted circular right floated button non-moveable">Help</div>
            </div>
            <div class="two wide center aligned middle aligned column">
                <div id="userDropdown" class="non-moveable ui inverted pointing dropdown">
                    <i class="user icon"></i>
                    {{username}}
                    <i class="dropdown icon"></i>
                    <div class="menu">
                        <div class="item">
                            <i class="id card outline icon"></i>Profile</div>
                        <div class="item">
                            <i class="sign out icon"></i>Logout</div>
                    </div>
                </div>
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
            <div class="four wide center aligned middle aligned column">
                <div class="ui icon inverted button pointing dropdown non-moveable">
                    <i class="setting icon"></i>
                    <div class="menu">
                        <div class="item">
                            <i class="id card outline icon"></i>
                            Profile
                        </div>
                        <div class="item">
                            <i class="sign out icon"></i>
                            Logout
                        </div>
                    </div>
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
                        <div class="ui middle aligned divided list" style="max-height:300px; min-width:300px; overflow:hidden">
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
                    </div>
                    <div class="ui button">
                        <i class="tasks icon"></i> {{tasks.length}}
                    </div>
                </span>
                <span v-if="!isSelecting">
                    <div class="ui icon right floated  inverted button non-moveable" @click="create('profile')">
                        <i class="plus icon"></i>
                        {{$t('profile.add.modpack')}}
                    </div>
                    <div class="ui icon right floated  inverted button non-moveable" @click="create('server')">
                        <i class="plus icon"></i>
                        {{$t('profile.add.server')}}
                    </div>
                </span>
                <span v-else>
                    <div class="ui icon right floated inverted button non-moveable" @click="launch">
                        &nbsp&nbsp&nbsp
                        <i class="rocket icon"></i>
                        {{$t('launch')}} &nbsp&nbsp&nbsp&nbsp
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
        ...mapGetters(['errors', 'tasks', 'errorsCount']),
        isSelecting() {
            return this.selectedProfileID != undefined && this.selectedProfileID != '' && this.selectedProfileID != null
        },
        username() {
            return this.$store.state.auth.authInfo ? this.$store.state.auth.authInfo.selectedProfile.name : 'Steve';
        },
    },
    mounted(e) {
        if (this.username === 'Steve') this.showLogin()
        $('#userDropdown').dropdown(
            {
                on: 'hover',
                action: function () {
                    return false
                }
            }
        )
        $('#warningPopup').popup(
            {
                hoverable: true,
                position: 'top left',
                delay: {
                    show: 300,
                    hide: 800
                },
            }
        )
        console.log(this.errors)
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
