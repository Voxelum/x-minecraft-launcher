<template>
    <div class="ui grid">
        <div class="eight wide column">
            <div class="ui sizer" style="font-size: 23px;">
                <h1 class="ui header">
                    <img v-if="status.icon!=''&& status.icon" class="ui image" :src="status.icon">
                    <div class="content">
                        <div class="ui transparent input">
                            <input type="text" name="Name" :placeholder="id" :value="source.name" @blur="modify">
                        </div>
                        <h2 class="ui sub header">
                            <text-component :source="status.gameVersion"></text-component>
                            Players: {{status.onlinePlayers}}/{{status.capacity}}
                            <br> Pings: {{status.pingToServer}} ms
                        </h2>
                    </div>
                </h1>
            </div>
            <div style="height:202px"></div>
        </div>
        <div class="eight wide column">
            <!-- <div class="ui very basic menu">
                <a class="item" data-tab="resourcepacks">
                    {{$t('resourcepacks')}}
                </a>
                <a class="item" data-tab="mods">
                    {{$t('mods')}}
                </a>
                <a class="item" data-tab="settings">
                    {{$t('settings')}}
                </a>
            </div>
            <div class="ui tab segment" data-tab="resourcepacks">
                <resource-pack-list style="height:380px"></resource-pack-list>
            </div>
            <div class="ui tab segment" style="height:380px" data-tab="mods">
                <p class="ui text">
                    BBB
                </p>
            </div>
            <div class="ui tab segment" style="height:380px" data-tab="settings">
    
            </div> -->
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import TextComponent from './TextComponent'
export default {
    props: ['source', 'id'],
    data() {
        return {
            status: {}
        }
    },
    computed: {
        type() { return this.source.type },
    },
    methods: {
        modify(event) {
            this.$store.commit('profiles/' + this.id + '/set' + event.target.name, event.target.value)
        },
        ping() {
            this.$store.dispatch(`profiles/${this.id}/ping`)
                .then((status) => {

                    this.status = status;
                })
        },
    },
    mounted() {
        this.ping();
        this.$nextTick(() => {
        })
    },
    components: { VersionDropdown, VersionTableView, ResourcePackList, TextComponent },
}
</script>

<style>

</style>
