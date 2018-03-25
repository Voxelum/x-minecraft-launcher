<template>
    <div class="ui vertically divided grid" style="max-height:500px; min-height:500px;">
        <div class="row" style="max-height:150px;min-height:150px;">
            <div class="eight wide column">
                <div class="ui sizer" style="font-size: 23px;">
                    <h1 class="ui header">
                        <div class="content">
                            {{name}}
                            <h2 class="ui sub header">
                                {{$t('author')}}: {{author}}
                            </h2>
                            <h2 ref="versionPopup" class="ui sub header">
                                {{$tc('version.name', 0)}}: {{version}}
                                <i class="dropdown icon"></i>
                            </h2>
                            <div class="ui flowing popup bottom left transition hidden grid">
                                <version-table-view :id="id" style="max-height:300px;overflow:auto"></version-table-view>
                            </div>
                        </div>
                    </h1>
                </div>
            </div>
            <div class="eight wide column">
                <h5 class="ui horizontal divider header">
                    <i class="tag icon"></i>
                    {{$t('description')}}
                </h5>
                <textarea :value="description" @blur="modify" style="width:100%;border:0;outline:none;overflow: hidden;resize:none;background-color:transparent;">
                </textarea>
            </div>
        </div>
        <div ref="bar" class="stretched row pushable ui top attached segment" style="min-height:350px;max-height:350px; border-right-width:0;border-right-color:transparent;border-radius:0px;">
            <div ref="sidebar" class="ui vertical sidebar secondary pointing menu grid" style="background-color:white;width:200px;border-right-style:none;" @mouseleave="closeBar">
                <div class="sixteen wide column">
                    <div class="header item">
                        {{$t('basic')}}
                    </div>
                    <router-link to="gamesettings" class="item" style="border-bottom:0;border-top:0;">{{$t('setting.name')}}</router-link>
                    <router-link to="maps" class="item"> {{$tc('map.name', 0)}} </router-link>
                    <router-link to="resourcepacks" class="item" style="border-bottom:0;border-top:0;">{{$tc('resourcepack.name', 0)}}</router-link>
                    <router-link to="mods" class="item">{{$tc('mod.name', 0)}}</router-link>
                    <router-link to="version" class="item"> {{$tc('version.name', 0)}}</router-link>
                    <router-link to="launchsettings" class="item">{{$t('launchsetting.name')}}</router-link>
                </div>

            </div>
            <div class="ui basic circular icon huge button" style="z-index: 10;position:absolute; margin:20px;" @mouseenter="openBar">
                <i class="options icon"></i>
            </div>
            <div class="pusher ui basic segment" style="overflow:auto; width:100%">
                <transition name="fade" mode="out-in">
                    <router-view style="padding: 5px 20px 10px 80px"></router-view>
                </transition>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'

export default {
    components: {
        VersionTableView: () => import('./VersionTableView'),
    },
    computed: {
        ...mapState('versions', ['minecraft']),
        id() { return this.$route.params.id },
        description() { return this.$store.getters[`profiles/${this.id}/modpack/description`] },
        author() { return this.$store.getters[`profiles/${this.id}/modpack/author`] },
        version() { return this.$store.getters[`profiles/${this.id}/mcversion`] || 'Unselected' },
        type() { return this.$store.getters[`profiles/${this.id}/type`] },
        name() { return this.$store.getters[`profiles/${this.id}/name`] || 'Untitled' },
    },
    methods: {
        modify(event) {
            this.$store.dispatch(`profiles/${this.id}/edit`, { description: event.target.value })
        },
        refresh() {
            this.$store.dispatch(`profiles/${this.id}/refresh`)
            this.$store.dispatch('versions/refresh')
        },
        openBar() {
            $(this.$refs.sidebar).sidebar('show')
        },
        closeBar() {
            $(this.$refs.sidebar).sidebar('hide')
        }
    },
    mounted() {
        this.refresh()
        $(this.$refs.sidebar)
            .sidebar({
                context: $(this.$refs.bar),
                dimPage: false
            })
            .sidebar('setting', 'transition', 'overlay')
        $(this.$refs.versionPopup).popup({
            position: 'bottom left',
            hoverable: true,
            delay: {
                show: 300,
                hide: 800
            }
        });
        $(this.$refs.acc).accordion()
    },
}
</script>

<style>

</style>
