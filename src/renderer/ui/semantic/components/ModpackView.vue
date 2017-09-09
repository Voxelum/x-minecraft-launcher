<template>
    <div class="ui vertically divided grid">
        <div class="row">
            <div class="eight wide column">
                <div class="ui sizer" style="font-size: 23px;">
                    <h1 class="ui header">
                        <div class="content">
                            {{source.name}}
                            <h2 class="ui sub header">
                                {{$t('author')}}: {{source.author}}
                            </h2>
                            <h2 id="versionPopup" class="ui sub header">
                                {{$tc('version.name', 0)}}: {{source.minecraft.version===''? 'Unselected':source.minecraft.version}}
                            </h2>
                            <version-table-view :id="id"></version-table-view>
                        </div>
                    </h1>
                </div>
            </div>
            <div class="eight wide column">
                <h5 class="ui horizontal divider header">
                    <i class="tag icon"></i>
                    {{$t('description')}}
                </h5>
                <textarea :value="source.description" @blur="modify" style="width:100%;border:0;outline:none;overflow: hidden;resize:none;background-color:transparent;">
                </textarea>
            </div>
        </div>
        <div class="stretched row" style="height:70%">
            <div class="four wide column">
                <div class="ui vertical secondary pointing menu">
                    <div class="header item">{{$t('basic')}}</div>
                    <a class="active item" data-tab="maps">
                        {{$tc('map.name', 0)}}
                    </a>
                    <a class="item" data-tab="settings">
                        {{$t('settings')}}
                    </a>
                    <a class="item" data-tab="resourcepacks">
                        {{$tc('resourcepack.name', 0)}}
                    </a>
                    <a class="item" data-tab="mods">
                        {{$tc('mod.name', 0)}}
                    </a>
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
            <div class="eleven wide column">
                <!-- <version-table-view :id="id"></version-table-view> -->
                <div class="ui active tab" style="height:380px" data-tab="maps">
                    <maps-list :id="id"></maps-list>
                </div>
                <div class="ui tab" style="height:380px" data-tab="settings">
                    <game-settings :id="id"></game-settings>
                </div>
                <div class="ui tab" style="height:380px" data-tab="resourcepacks">
                    <resource-pack-list :id="id"></resource-pack-list>
                </div>
                <div class="ui tab" style="height:380px" data-tab="mods">
                    <mods-list :id="id"></mods-list>
                </div>
                <div class="ui tab" data-tab="forge">
                </div>
                <div class="ui tab" data-tab="liteloader">
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import VersionTableView from './VersionTableView'
import ResourcePackList from './ResourcePackList'
import TextComponent from './TextComponent'
import GameSettings from './GameSettings'
import MapsList from './MapsList'
import ModsList from './ModsList'

export default {
    components: {
        VersionTableView, ResourcePackList, TextComponent,
        GameSettings, MapsList, ModsList
    },
    props: ['source', 'id'],
    computed: {
        ...mapState('versions', ['minecraft']),
        versions() { return this.minecraft.versions },
        type() { return this.source.type },
    },
    methods: {
        modify(event) {
            this.$store.commit(`profiles/${this.id}/putAll`, { description: event.target.value })
        },
        refresh() {
            this.$store.dispatch(`profiles/${this.id}/refresh`)
            this.$store.dispatch('versions/refresh')
        },
    },
    mounted() {
        this.refresh()
        $('#versionPopup').popup({
            position: 'bottom left',
            hoverable: true,
            delay: {
                show: 300,
                hide: 800
            }
        });
        $('#acc').accordion()
        $('.menu .item').tab()
    },
}
</script>

<style>

</style>
