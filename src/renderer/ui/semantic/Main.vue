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
                        <profile-card class="profile" v-for="id in keys" :key="id" :id="id" :source='getByKey(id)' @select="selectProfile" @delete="showDelete"></profile-card>
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
                <div class="ui icon right floated circlar inverted button non-moveable" @click="createModpack">
                    <i class="plus icon"></i>
                    {{$t('profile.add.modpack')}}
                </div>
                <div class="ui icon right floated circlar inverted button non-moveable" @click="createServer">
                    <i class="plus icon"></i>
                    {{$t('profile.add.server')}}
                </div>
            </div>
        </div>
        <div id="login" class="ui basic modal" style="padding:0 20% 0 20%;">
            <i class="close icon" v-if="this.$store.state.auth.authInfo !== undefined"></i>
            <login @logined='onlogined'></login>
        </div>
        <div id="delete" class="ui small basic test modal transition hidden">
            <i class="close icon"></i>
            <div class="ui icon header">
                <i class="archive icon"></i>
                <p v-if="deleting!=''"> {{$t(`profile.delete.${deleting}`)}}</p>
            </div>
            <div class="content">
                <p v-if="deleting!=''">{{$t(`profile.delete.${deleting}.description`)}}</p>
            </div>
            <div class="actions">
                <div class="ui basic cancel inverted button">
                    <i class="close icon"></i>{{$t('profile.delete.no')}}</div>
                <div class="ui red basic inverted ok button">
                    <i class="remove icon"></i>{{$t('profile.delete.yes')}}</div>
            </div>
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
    data() {
        return {
            deleting: '',
        }
    },
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
            createProfile: 'create',
            selectProfile: 'select',
            deleteProfile: 'delete',
        }),
        ...mapMutations('profiles', {
            unselect: 'unselect',
        }),
        showDelete(event) {
            const self = this
            this.deleting = event.source.type
            this.$nextTick(() => {
                $('#delete')
                    .modal({
                        blurring: true,
                        onApprove($element) {
                            self.deleteProfile(event.id)
                            return true;
                        },
                        onDeny($element) {
                        },
                    })
                    .modal('show')
            })
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
        createModpack() {
            this.createProfile({ type: 'modpack', option: { author: this.playerName } })
                .then(id => {
                    this.selectProfile(id)
                })
        },
        createServer() {
            this.createProfile({ type: 'server', option: {} })
                .then(id => {
                    this.selectProfile(id)
                })
        }
    },
    components: { ProfileCard, ProfileView, SkinView, Login }
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