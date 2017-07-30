<template>
    <div class="ui grid">
        <div class="eight wide column">
            <div class="ui sizer" style="font-size: 23px;">
                <h1 class="ui header">
                    <div class="ui transparent input">
                        <input type="text" name="Name" :placeholder="id" :value="source.name" @blur="modify">
                    </div>
                    <h2 v-if="type==='modpack'" class="ui sub header">
                        Author:
                        <div class="ui transparent input">
                            <input type="text" name="Author" placeholder="Unknown author..." :value="source.author" @blur="modify">
                        </div>
                    </h2>
                    <h2 v-if="type==='modpack'" class="ui sub header">
                        Version: {{source.version}}
                    </h2>
                    <h2 v-if="type==='server'" class="ui sub header">
                        Version:
                        <text-component :source="source.status.version"></text-component>
                        Players: {{source.status.players}}/{{source.status.capacity}} Pings: {{source.status.ping}} ms
                    </h2>
                </h1>
            </div>
            <div style="height:202px"></div>
            <div v-if="type==='modpack'" class="ui row piled segment" style="padding:35px 10px 10px 10px; height:150px;">
                <label class="ui top left attached label">Description</label>
                <label class="ui bottom right attached label">Edit</label>
                <textarea :value="source.description" name="Description" @blur="modify" style="border:0;outline:none;overflow: hidden;resize:none">
                </textarea>
            </div>
        </div>
        <div class="eight wide column">
            <div class="ui very basic menu">
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
            <!-- <div class="ui tab container" data-tab="versions">
                                                                                                                                                                            </div> -->
            <div class="ui tab segment" data-tab="resourcepacks">
                <resource-pack-list style="height:380px"></resource-pack-list>
            </div>
            <div class="ui tab segment" style="height:380px" data-tab="mods">
                <p class="ui text">
                    BBB
                </p>
            </div>
            <div class="ui tab segment" style="height:380px" data-tab="settings">
    
            </div>
    
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import VersionDropdown from './VersionDropdown'
import VersionTableView from './VersionTableView'
import ResourcePackList from './ResourcePackList'
import TextComponent from './TextComponent'
export default {
    props: ['source', 'id'],
    computed: {
        ...mapState('versions', ['minecraft']),
        versions() { return this.minecraft.versions },
        type() { return this.source.type },
    },
    methods: {
        modify(event) {
            this.$store.commit('profiles/' + this.id + '/set' + event.target.name, event.target.value)
        },
        ...mapActions('versions', ['refresh']),
        ping() {
            this.$store.dispatch(`profiles/${this.id}/ping`)
                .then(() => {
                    console.log(this.source.status)
                })
        },
        showVersionPopup(event) {
            this.$nextTick(() => {
                $('#versionPopup')
                    .popup({
                        inline: true,
                        // hoverable: true,
                        position: 'bottom left',
                        delay: {
                            show: 300,
                            hide: 800
                        }
                    })
            })
        },
    },
    mounted() {
        if (this.type === 'server')
            this.ping();
        else
            this.refresh()
        this.$nextTick(() => {
            $('.menu .item').tab()
            $('.dropdown').dropdown()
        })
    },
    components: { VersionDropdown, VersionTableView, ResourcePackList, TextComponent },
}
</script>

<style>

</style>
