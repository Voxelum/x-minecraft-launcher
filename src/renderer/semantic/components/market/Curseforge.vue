<template>
    <div class="ui three doubling cards" style="overflow-x:hidden;">
        <router-link :to="{ path: 'curseforge/mc-mods', params:{project: 'mc-mods'}}"  class="card">
            <div class="image">
                <img src="https://media.forgecdn.net/avatars/thumbnails/52/100/64/64/636111139251397737.png">
            </div>
            <div class="content">
                <div class="header">
                    Mods
                </div>
                <div class="description">
                    {{$t('curseforge.mod.description')}}
                </div>
            </div>
        </router-link>
        <router-link :to="{ path: 'curseforge/texture-packs', params:{project: 'texture-packs'}}" class="card">
            <div class="image">
                <img src="https://media.forgecdn.net/avatars/thumbnails/52/102/64/64/636111139761599118.png">
            </div>
            <div class="content">
                <div class="header">
                    {{$t('resourcepack.name')}}
                </div>
                <div class="description">
                    {{$t('curseforge.resourcepack.description')}}
                </div>
            </div>
        </router-link>
        <router-link :to="{ path: 'curseforge/worlds', params:{project: 'worlds'}}"  class="card">
            <div class="image">
                <img src="https://media.forgecdn.net/avatars/thumbnails/52/103/64/64/636111139893035422.png">
            </div>
            <div class="content">
                <div class="header">
                    {{$t('world.name')}}
                </div>
                <div class="description">
                    {{$t('curseforge.world.description')}}
                </div>
            </div>
        </router-link>
    </div>
</template>

<script>
import vuex from 'vuex'
export default {
    data: () => ({
        projects: [],
        page: 1,
        pages: 1,
        version: '',
        versions: [],
        filter: '',
        filters: [],
        category: '',
        categories: [],
        loading: false,
    }),
    computed: {
    },
    mounted() {
        if (this.projects.length === 0) this.change()
        $(this.$refs.filterDropdown).dropdown()
        $(this.$refs.versionDropdown).dropdown()
    },
    created() {
        $(this.$refs.filterDropdown).dropdown()
        $(this.$refs.versionDropdown).dropdown()
    },
    methods: {
        ...vuex.mapActions('curseforge', { fetchMods: 'mods' }),
        /**
         * @param {{path:string, version:string, filter:string}} payload 
         */
        fetch(payload) {
            const filter = payload.filter || this.filter;
            const version = payload.version || this.version;
            const page = payload.page || this.page;
            this.loading = true;

            return this.fetchMods({ page, version, sort: filter })
                .then((s) => {
                    this.projects = s.mods;
                    this.page = page;
                    this.pages = s.pages;
                    this.filter = filter;
                    this.filters = s.filters;
                    this.version = version;
                    this.versions = s.versions;
                    this.loading = false;
                });
        },
        change({ page, version, filter } = {}) {
            if ((version || filter) && this.page !== 1) page = 1;
            this.fetch({ page, version, filter }).then(() => {
                this.$nextTick(() => {
                    $('#filterDropdown').dropdown()
                    $('#versionDropdown').dropdown()
                })
            })
        },
    },
}
</script>

<style>

</style>
