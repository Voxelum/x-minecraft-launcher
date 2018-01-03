<template>
    <div class="ui vertically divided grid" style="max-height:500px; min-height:500px;">
        <modpack-row v-if="type==='modpack'"></modpack-row>
        <server-row v-else></server-row>
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
                    <div ref="acc" class="ui accordion">
                        <a class="title header item">
                            {{$t('advanced')}}
                        </a>
                        <div class="content">
                            <router-link to="forge" class="item" data-tab="forge">
                                {{$t('forge.name')}}
                            </router-link>
                            <router-link to="launchsettings" class="item">Launch Settings</router-link>
                        </div>
                    </div>
                </div>
            </div>
            <div class="ui basic circular icon huge button" style="z-index: 10;position:absolute; margin:20px;" @mouseenter="openBar">
                <i class="options icon"></i>
            </div>
            <div class="pusher ui basic segment" style="overflow:auto; width:100%">
                <transition name="fade" mode="out-in">
                    <router-view style="padding: 10px 20px 10px 80px"></router-view>
                </transition>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'

export default {
    components: {
        ModpackRow: () => import('./ModpackRow'),
        ServerRow: () => import('./ServerRow'),
    },
    computed: {
        type() { return this.$store.getters[`profiles/${this.id}/type`] },
        id() { return this.$route.params.id; },
    },
    methods: {
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
        $(this.$refs.acc).accordion()
    },
}
</script>

<style>

</style>
