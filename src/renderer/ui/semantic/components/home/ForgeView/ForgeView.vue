<template>
    <div>
        <div ref="dropdown" class="ui floating labeled icon search dropdown button">
            <i class="circle icon"></i>
            <span class="text">{{version ===''? $t('forge.non'):version}}</span>
            <div class="menu">
                <div class="item" @click="unselect">
                    {{$t('forge.non')}}
                </div>
                <div v-if="recommendedVersions" class="header">
                    {{$t('forge.recommended')}}
                </div>
                <div class="item" v-if="recommendedVersions" @click="selectVersion(recommendedVersions)">
                    {{recommendedVersions.version}}
                </div>
                <div v-if="latestVersions" class="header">
                    {{$t('forge.latest')}}
                </div>
                <div class="item" v-if="latestVersions" @click="selectVersion(latestVersions)">
                    {{latestVersions.version}}
                </div>
                <div class="header">
                    {{$t('forge.common')}}
                </div>
                <div class="item" v-for="ver in versions" :key="ver.version" @click="selectVersion(ver)">
                    {{ver.version}}
                </div>
            </div>
        </div>
        <div class="ui button" @click="installForge">{{$t('forge.install')}}</div>
    </div>
</template>

<script>
import vuex from 'vuex'
export default {
    data: () => ({
        loading: false
    }),
    mounted() {
        $(this.$refs.dropdown).dropdown();
        if (!this.versions || this.versions.length === 0) {
            this.refresh();
        }
        // if (this.selectingMeta === undefined) {
        //     this.unselect();
        // }
    },
    watch: {
    },
    computed: {
        selectingMeta() {
            return this.versions.filter(ver => ver.version === this.version)[0]
        },
        id() { return this.$route.params.id; },
        mcversion() { return this.$store.getters[`profiles/${this.id}/mcversion`] },
        version() { return this.$store.getters[`profiles/${this.id}/forgeVersion`] },
        versions() { return this.$store.getters['forge/versionsByMc'](this.mcversion) || [] },
        latestVersions() { return this.$store.getters['forge/latestByMc'](this.mcversion) },
        recommendedVersions() { return this.$store.getters['forge/recommendedByMc'](this.mcversion) },
        // settings() { return this.$store.getters[`profiles/${this.id}/forge/settings`] },
        // mods() { return this.$store.getters[`profiles/${this.id}/forge/mods`] },
    },
    methods: {
        unselect() {
            this.$store.dispatch(`profiles/${this.id}/setForgeVersion`, '')
        },
        selectVersion(ver) {
            this.$store.dispatch(`profiles/${this.id}/setForgeVersion`, ver.version)
        },
        installForge() {
            if (this.selectingMeta)
                this.$store.dispatch('forge/download', this.selectingMeta);
        },
        refresh() {
            this.loading = true
            this.$store.dispatch('forge/refresh')
                .then(() => { this.loading = false });
        },
    },
}
</script>

<style>

</style>
