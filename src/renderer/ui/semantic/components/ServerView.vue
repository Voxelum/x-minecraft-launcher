<template>
    <div class="ui vertically divided grid" style="height:105%">
        <div class="row">
            <div class="eight wide column"  @click="openBar">
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
        <div id="bar" class="stretched row pushable" style="min-height:70%; max-heigth:70%">

            <!-- <div id="bar" class="ui segment pushable"> -->
            <div id="sidebar" class="ui inline vertical sidebar secondary pointing menu" style="background-color:white">
                <a class="active item" data-tab="settings">{{$t('settings')}}</a>
                <a class="item" data-tab="resourcepack">{{$tc('resourcepack.name', 0)}}</a>
                <a class="item" data-tab="mods">{{$tc('mod.name', 0)}}</a>
                <div id="acc" class="ui accordion">
                    <a class="title header item">
                        {{$t('advanced')}}
                    </a>
                    <div class="content">
                        <a class="item" data-tab="forge">
                            {{$t('forge')}}
                        </a>
                        <a class="item" data-tab="liteloader">
                            {{$t('liteloader')}}
                        </a>
                    </div>
                </div>
            </div>
            <div class="pusher">
                <div class="ui basic segment">
                    <h3 class="ui header">Application Content</h3>
                    <p></p>
                    <p></p>
                    <p></p>
                    <p></p>
                </div>
            </div>
            <!-- </div> -->
            <!-- <div class="four wide column">
                <div class="ui vertical secondary pointing menu">
                    <div class="header item">{{$t('basic')}}</div>
                    <a class="active item" data-tab="settings">{{$t('settings')}}</a>
                    <a class="item" data-tab="resourcepack">{{$tc('resourcepack.name', 0)}}</a>
                    <a class="item" data-tab="mods">{{$tc('mod.name', 0)}}</a>
                    <div id="acc" class="ui accordion">
                        <a class="title header item">
                            {{$t('advanced')}}
                        </a>
                        <div class="content">
                            <a class="item" data-tab="forge">
                                {{$t('forge')}}
                            </a>
                            <a class="item" data-tab="liteloader">
                                {{$t('liteloader')}}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="one wide column"></div>
            <div class="eleven wide column" style="padding: 0 5% 0 0px">
                <div class="ui active tab" data-tab="settings">
                    <game-settings :id="id"></game-settings>
                </div>
                <div class="ui tab" data-tab="resourcepack">
                    <resource-pack-list :id="id"></resource-pack-list>
                </div>
                <div class="ui tab" data-tab="mods">
                    <mods-list :id="id"></mods-list>
                </div>
                <div class="ui tab" data-tab="forge">
                    <forge-view :id="id"></forge-view>
                </div>
                <div class="ui tab" data-tab="liteloader">
                </div>
            </div> -->
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import TextComponent from './TextComponent'
import ResourcePackList from './ResourcePackList'
import GameSettings from './GameSettings'
import ModsList from './ModsList'
import ForgeView from './ForgeView'

export default {
    components: { TextComponent, ResourcePackList, GameSettings, ModsList, ForgeView },
    computed: {
        status() { return this.source.status },
        type() { return this.source.type },
        id() { return this.$route.params.id },
        source() { return this.$store.state.profiles[this.id] }
    },
    methods: {
        refresh(force) {
            this.$store.dispatch(`profiles/${this.id}/refresh`, force)
        },
        openBar() {
            $('#sidebar').sidebar('toggle')
        }
    },
    mounted() {
        $('#sidebar')
            .sidebar({
                context: $('#bar'), dimPage: false
            })
            .sidebar('setting', 'transition', 'overlay')
            .sidebar('attach events', '.context.example .menu .item')
        $('#acc').accordion()
        $('.menu .item').tab()
        this.refresh();
    },
}
</script>

<style scoped=true>
.ui.tab {
    height: 100%
}
</style>
