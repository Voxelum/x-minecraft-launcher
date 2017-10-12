<template>
    <div class="ui vertically divided grid" style="height:105%">
        <div class="row">
            <div class="eight wide column" @click="openBar">
                <h1 class="ui header">
                    <img v-if="status.icon!=''&& status.icon" class="ui image" :src="status.icon"></img>
                    <i v-else class="server icon"></i>
                    <div class="content">
                        {{source.name}}
                        <h2 class="ui sub header">
                            <text-component :source="status.gameVersion" localized="true"></text-component>
                        </h2>
                        <h2 class="ui sub header">
                            {{$t('server.players')}}: {{status.onlinePlayers}}/{{status.capacity}}
                        </h2>
                        <h3 class="ui sub header">
                            {{$t('server.pings')}}: {{status.pingToServer}} ms
                        </h3>
                    </div>
                </h1>
            </div>
            <div class="eight wide column">
                <h5 class="ui horizontal divider header">
                    <i class="tag icon"></i>
                    {{$t('server.motd')}}
                </h5>
                <text-component :source="status.serverMOTD" localized="true"></text-component>
            </div>
        </div>
        <div ref="bar" class="stretched row pushable ui top attached segment" style="border-right-width:0;border-right-color:transparent;border-radius:0px;">
            <div ref="sidebar" class="ui vertical sidebar secondary pointing menu grid" style="background-color:white;width:200px;border-right-style:none;">
                <div class="sixteen wide column">
                    <div class="header item">
                        {{$t('basic')}}
                    </div>
                    <router-link to="gamesettings" class="item" style="border-bottom:0;border-top:0;">{{$t('setting.name')}}</router-link>
                    <router-link to="resourcepacks" class="item" style="border-bottom:0;border-top:0;">{{$tc('resourcepack.name', 0)}}</router-link>
                    <router-link to="mods" class="item">{{$tc('mod.name', 0)}}</router-link>
                    <div class="header item">
                        {{$t('advanced')}}
                    </div>
                    <a class="item">
                        {{$t('forge')}}
                    </a>
                    <a class="item">
                        {{$t('liteloader')}}
                    </a>
                </div>
            </div>
            <div class="ui basic circular icon huge button" style="position:absolute; margin:20px;" @click="openBar">
                <i class="options icon"></i>
            </div>
            <div class="pusher ui basic segment padded text container" style="min-height:70%; max-heigth:70%;">
                <router-view></router-view>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import TextComponent from './TextComponent'

export default {
    components: { TextComponent },
    computed: {
        status() { return this.source.status },
        type() { return this.source.type },
        source() { return this.$store.state.profiles[this.id] }
    },
    methods: {
        refresh(force) {
            this.$store.dispatch(`profiles/${this.id}/refresh`, force)
        },
        openBar() {
            $(this.$refs.sidebar).sidebar('toggle')
        }
    },
    mounted() {
        if(!this.id) throw new Error('Unexpected state for undefined id!')
        if(!this.source) throw new Error(`Unexpected undefined state for id ${this.id}!`)
        $(this.$refs.sidebar)
            .sidebar({
                context: $(this.$refs.bar),
                dimPage: false
            })
            .sidebar('setting', 'transition', 'overlay')
        this.refresh();
    },
    props: ['id']
}
</script>

<style scoped=true>
.ui.tab {
    height: 100%
}
</style>
