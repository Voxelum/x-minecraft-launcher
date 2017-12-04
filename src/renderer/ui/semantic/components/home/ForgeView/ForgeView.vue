<template>
    <div>
        <div ref="dropdown" class="ui floating labeled icon search dropdown button">
            <i class="circle icon"></i>
            <span class="text">{{version ===''? 'No Forge':version}}</span>
            <div class="menu">
                <div class="item" @click="unselect">
                    No Forge
                </div>
                <div v-if="recommendedVersions" class="header">
                    Recommended
                </div>
                <div class="item" v-if="recommendedVersions" @click="selectVersion(recommendedVersions)">
                    {{recommendedVersions.version}}
                </div>
                <div v-if="latestVersions" class="header">
                    Latest
                </div>
                <div class="item" v-if="latestVersions" @click="selectVersion(latestVersions)">
                    {{latestVersions.version}}
                </div>
                <div class="header">
                    Common
                </div>
                <div class="item" v-for="ver in versions" :key="ver.version" @click="selectVersion(ver)">
                    {{ver.version}}
                </div>
            </div>
        </div>
        <div class="ui checkbox">
            Show other mc version
        </div>
        <div class="ui checkbox">
            Latest only
        </div>
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
    },
    watch: {
    },
    computed: {
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
