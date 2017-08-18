<template>
    <div class="ui vertically divided grid" style="height:105%">
        <div class="row">
            <div class="eight wide column">
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
        <div class="stretched row" style="height:70%">
            <div class="four wide column">
                <div class="ui vertical fluid tabular menu">
                    <a class="active item" data-tab="settings">{{$t('settings')}}</a>
                    <a class="item" data-tab="resourcepack">{{$tc('resourcepack.name', 0)}}</a>
                    <a class="item" data-tab="mods">{{$tc('mod.name', 0)}}</a>
                </div>
            </div>
            <div class="twelve wide column" style="padding: 0 5% 0 20px">
                <div class="ui active tab" data-tab="settings">
                    <game-settings :id="id"></game-settings>
                </div>
                <div class="ui tab" data-tab="resourcepack">
                    <resource-pack-list :id="id"></resource-pack-list>
                </div>
                <div class="ui tab" data-tab="mods">
                    <mods-list :id="id"></mods-list>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import TextComponent from './TextComponent'
import ResourcePackList from './ResourcePackList'
import GameSettings from './GameSettings'
import ModsList from './ModsList'

export default {
    components: { TextComponent, ResourcePackList, GameSettings, ModsList },
    props: ['source', 'id'],
    computed: {
        status() { return this.source.status },
        type() { return this.source.type },
    },
    methods: {
        refresh(force) {
            this.$store.dispatch(`profiles/${this.id}/refresh`, force)
        },
    },
    mounted() {
        this.$nextTick(() => {
            $('.menu .item').tab()
        })
        this.refresh();
    },
}
</script>

<style scoped=true>
.ui.tab {
    height: 100%
}
</style>
