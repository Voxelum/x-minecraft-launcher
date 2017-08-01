<template>
    <div class="ui grid">
        <div class="eight wide column">
            <div class="ui sizer" style="font-size: 23px;">
                <h1 class="ui header">
                    <div class="content">
                        <div class="ui transparent input">
                            <input type="text" name="Name" :placeholder="id" :value="source.name" @blur="modify">
                        </div>
                        <h2 class="ui sub header">
                            Author:
                            <div class="ui transparent input">
                                <input type="text" name="Author" placeholder="Unknown author..." :value="source.author" @blur="modify">
                            </div>
                        </h2>
                        <h2 class="ui sub header">
                            Version: {{source.version}}
                        </h2>
                    </div>
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
import VersionTableView from '../VersionTableView'
import ResourcePackList from '../ResourcePackList'
import TextComponent from '../TextComponent'
export default {
    components: { VersionTableView, ResourcePackList, TextComponent },
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
        refresh() {
            this.$store.dispatch(`profiles/${this.id}/refresh`)
        },
        // ...mapActions('versions', ['refresh']),
    },
    mounted() {
        this.refresh()
        this.$nextTick(() => {
            $('.menu .item').tab()
        })
    },
}
</script>

<style>

</style>
