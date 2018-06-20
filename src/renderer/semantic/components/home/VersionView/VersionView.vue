<template>
    <div>
        <div class="ui secondary menu">
            <div class="active item tab-item" data-tab="minecraft" @click="switchToMinecraft">{{$t('minecraft')}}</div>
            <div class="item tab-item" data-tab="forge" @click="switchToForge">{{$t('forge.name')}}</div>
            <div class="item tab-item" data-tab="liteloader" @click="switchToLiteloader">{{$t('liteloader.name')}}</div>
            <div class="item tab-item" data-tab="local" @click="switchToLocal">{{$t('version.locals')}}</div>
            <div class="right menu">
                <div class="ui left icon action input">
                    <i class="search icon"></i>
                    <input type="text" placeholder="Filter" v-model="filter">
                    <span ref="alphaDropdown" class="ui basic floating dropdown button">
                        <div class="text">{{$t(`version.${filterType}`)}}</div>
                        <i class="dropdown icon"></i>
                        <div class="menu">
                            <div class="item" v-for="t in filterTypes" :key="t" @click="filterType=t">{{$t(`version.${t}`)}}</div>
                        </div>
                    </span>
                </div>
            </div>
        </div>

        <div class="ui divider"></div>
        <div class="ui active tab" data-tab="minecraft">
            <table class="ui very basic selectable celled table" style='overflow-x: hidden;'>
                <tbody>
                    <mc-version-cell v-for="meta in mcMetas" :meta="meta" :selected="mcVersion===meta.id" :key="meta.id" @select="selectMinecraft(meta)" @download="downloadMinecraft(meta)"></mc-version-cell>
                </tbody>
            </table>
        </div>
        <div class="ui tab" data-tab="forge">
            <div class="ui center aligned middle aligned basic segment" v-if="!mcVersion">
                <br>
                <h2 class="ui icon header">
                    <i class="exclamation icon"></i>
                    <div class="sub header">{{$t('version.selectHint')}}</div>
                </h2>
            </div>
            <div class="ui center aligned middle aligned basic segment" v-else-if="forgeMetas.length === 0">
                <br>
                <h2 class="ui icon header">
                    <i class="exclamation icon"></i>
                    <div class="sub header">{{$t('version.noForge')}}</div>
                </h2>
            </div>
            <table v-else class="ui very basic selectable celled table" style='overflow-x: hidden;'>
                <tbody>
                    <forge-version-cell v-for="meta in forgeMetas" :meta="meta" :selected="forgeVersion===meta.version" :key="meta.id" @select="selectForge(meta)" @download="downloadForge(meta)"></forge-version-cell>
                </tbody>
            </table>
        </div>
        <div class="ui tab" data-tab="liteloader">
            <div class="ui center aligned middle aligned basic segment" v-if="!mcVersion">
                <br>
                <h2 class="ui icon header">
                    <i class="exclamation icon"></i>
                    <div class="sub header">{{$t('version.selectHint')}}</div>
                </h2>
            </div>
            <div class="ui center aligned middle aligned basic segment" v-else-if="liteMetas.length === 0">
                <br>
                <h2 class="ui icon header">
                    <i class="exclamation icon"></i>
                    <div class="sub header">{{$t('version.noLiteloader')}}</div>
                </h2>
            </div>
            <table v-else class="ui very basic selectable celled table" style='overflow-x: hidden;'>
                <tbody>
                    <liteloader-version-cell v-if="liteMetas.release" :meta="liteMetas.release" :selected="liteVersion===liteMetas.release.version" :key="liteMetas.release.id" @select="selectLite(liteMetas.release)" @download="downloadLite(liteMetas.release)"></liteloader-version-cell>
                    <liteloader-version-cell v-if="liteMetas.snapshot" :meta="liteMetas.snapshot" :selected="liteVersion===liteMetas.snapshot.version" :key="liteMetas.snapshot.id" @select="selectLite(liteMetas.snapshot)" @download="downloadLite(liteMetas.snapshot)"></liteloader-version-cell>
                </tbody>
            </table>
        </div>
        <div class="ui tab" data-tab="local">
            <table class="ui very basic selectable celled table" style='overflow-x: hidden;'>
                <thead>
                    <tr>
                        <th>{{$t('version.id')}}</th>
                        <th>{{$t('minecraft')}}</th>
                        <th>{{$t('forge.name')}}</th>
                        <th>{{$t('liteloader.name')}}</th>
                    </tr>
                </thead>
                <tbody>
                    <local-version-cell v-for="meta in localVersions" :meta="meta" :selected="forgeVersion===meta.forge && mcVersion===meta.minecraft && liteVersion===meta.liteloader" :key="meta.id" @select="selectLocal"></local-version-cell>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    components: {
        McVersionCell: () => import('./McVersionCell'),
        ForgeVersionCell: () => import('./ForgeVersionCell'),
        LiteloaderVersionCell: () => import('./LiteloaderVersionCell'),
        LocalVersionCell: () => import('./LocalVersionCell'),
    },
    data: () => ({
        loading: false,
        filterType: 'release',
        filterTypes: ['release', 'snapshot', 'all'],
        filter: '',
    }),
    mounted() {
        $('.secondary.menu .item').tab();
        $(this.$refs.alphaDropdown).dropdown();
    },
    computed: {
        id() { return this.$route.params.id; },

        localVersions() { return this.$store.state.versions.local; },

        mcMetas() {
            let metas = this.$store.getters['versions/minecraft/versions'];
            if (this.filterType !== 'all')
                metas = metas.filter(v => v.type === this.filterType)
            if (this.filter !== '')
                metas = metas.filter(v => v.id.includes(this.filter))
            return metas
        },
        mcVersion() { return this.$store.getters[`profiles/${this.id}/mcversion`] },

        liteMetas() {
            return this.$store.getters['versions/liteloader/versions'](this.mcVersion);
        },
        liteVersion() {
            return this.$store.getters[`profiles/${this.id}/liteloader/version`]
                || this.$t('version.none')
        },

        forgeMetas() {
            let metas = this.$store.getters['versions/forge/versions'](this.mcVersion) || [];
            if (this.filterType !== 'all')
                metas = metas.filter(v => v.type === this.filterType)
            if (this.filter !== '')
                metas = metas.filter(v => v.id.includes(this.filter))
            return metas
        },
        forgeVersion() {
            return this.$store.getters[`profiles/${this.id}/forge/version`]
                || this.$t('version.none')
        },
    },
    methods: {
        switchToLocal() {
            this.filterTypes = ['all']
            this.filterType = 'all'
            $(this.$refs.alphaDropdown).dropdown();
        },
        switchToMinecraft() {
            this.filterTypes = ['release', 'snapshot', 'all']
            this.filterType = 'release'
            $(this.$refs.alphaDropdown).dropdown();
        },
        switchToForge() {
            this.filterTypes = ['recommended', 'latest', 'all']
            this.filterType = 'recommended'
            $(this.$refs.alphaDropdown).dropdown();
        },
        switchToLiteloader() {
            this.filterTypes = ['all']
            this.filterType = 'all'
            $(this.$refs.alphaDropdown).dropdown();
        },

        downloadMinecraft(meta) {
            this.$store.dispatch(`versions/minecraft/download`, meta);
        },
        downloadForge(meta) {
            this.$store.dispatch(`versions/forge/download`, meta);
        },
        downloadLite(meta) {
            this.$store.dispatch(`versions/liteloader/download`, meta);
        },

        selectLocal(local) {
            this.$store.dispatch(`profiles/${this.id}/edit`, { mcversion: local.minecraft });
            this.$store.dispatch(`profiles/${this.id}/forge/setVersion`, local.forge || '');
            this.$store.dispatch(`profiles/${this.id}/liteloader/setVersion`,
                local.liteloader || '');
        },
        selectMinecraft(meta) {
            const ver = this.mcVersion === meta.id ? '' : meta.id;
            this.$store.dispatch(`profiles/${this.id}/edit`, { mcversion: ver });
        },
        selectForge(meta) {
            const ver = this.forgeVersion === meta.version ? '' : meta.version;
            this.$store.dispatch(`profiles/${this.id}/forge/setVersion`, ver);
        },
        selectLite(meta) {
            const ver = this.liteVersion === meta.version ? '' : meta.version;
            this.$store.dispatch(`profiles/${this.id}/liteloader/setVersion`, ver);
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
.tab-item {
  cursor: pointer;
}
.tab-item:hover {
  background-color: rgba(0, 0, 0, 0.05) !important;
}
</style>
