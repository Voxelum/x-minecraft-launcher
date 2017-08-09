<template>
    <div class="ui vertically divided grid" style="height:105%">
        <div class="row">
            <div class="eight wide column">
                <h1 class="ui header">
                    <img v-if="status.icon!=''&& status.icon" class="ui image" :src="status.icon">
                    <div class="content">
                        <h2 class="ui header">
                            {{source.name}}
                            <h2 class="ui sub header">
                                <text-component :source="status.gameVersion"></text-component>
                            </h2>
                            <h2 class="ui sub header">
                                {{$t('server.players')}}: {{status.onlinePlayers}}/{{status.capacity}}
                                <br> {{$t('server.pings')}}: {{status.pingToServer}} ms
                            </h2>
                        </h2>
                    </div>
                </h1>
            </div>
            <div class="eight wide column">
                <h5 class="ui horizontal divider header">
                    <i class="tag icon"></i>
                    Server MOTD
                </h5>
                <text-component :source="status.serverMOTD"></text-component>
            </div>
        </div>
        <div class="stretched row" style="height:70%">
            <div class="five wide column" style="">
                <div class="ui vertical  fluid tabular menu">
                    <a class="item" data-tab="common">Common</a>
                    <a class="item" data-tab="resourcepack">ResourcePacks</a>
                    <a class="item" data-tab="mods">Mods</a>
                    <a class="item" data-tab="advance">Advance</a>
                </div>
            </div>
            <div class="eleven wide column">
                <div class="ui active tab" data-tab="common">A</div>
                <div class="ui tab" data-tab="resourcepack">
                    <resource-pack-list></resource-pack-list>
                </div>
                <div class="ui tab" data-tab="mods">C</div>
                <div class="ui tab" data-tab="advance">D</div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import TextComponent from './TextComponent'
import ResourcePackList from './ResourcePackList'
export default {
    components: { TextComponent, ResourcePackList },
    props: ['source', 'id'],
    computed: {
        status() { return this.source.status },
        type() { return this.source.type },
    },
    methods: {
        modify(event) {
            this.$store.commit(`profiles/${this.id}/set${event.target.name}`, event.target.value)
        },
        refresh() {
            this.$store.dispatch(`profiles/${this.id}/refresh`)
        },
    },
    mounted() {
        this.$nextTick(() => {
            $('.menu .item').tab()
        })
        if (!this.$store.state.auth.authInfo) this.refresh();
    },
}
</script>

<style>

</style>
