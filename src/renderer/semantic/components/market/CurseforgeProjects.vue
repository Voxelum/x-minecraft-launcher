<template>
    <div>
        <div v-if="loading" class="ui active inverted dimmer">
            <div class="ui text loader">Loading</div>
        </div>
        <div ref="filterDropdown" class="ui labeled icon top right pointing basic dropdown">
            <i class="filter icon"></i>
            <span class="text">
                <label>{{$t('popular')}}</label>
            </span>
            <div class="menu">
                <div class="item" v-for="f of filters" :key="f.value" @click="change({filter: f.value})">
                    {{f.text}}
                </div>
            </div>
            <i class="dropdown icon"></i>
        </div>
        <div ref="versionDropdown" class="ui labeled icon top right pointing scrolling basic dropdown">
            <i class="filter icon"></i>
            <span class="text">
                <label>{{$t('version.allVersion')}}</label>
            </span>
            <div class="menu">
                <div class="item" v-for="v of versions" :key="v.value" @click="change({version:v.value})">
                    {{v.text}}
                </div>
            </div>
            <i class="dropdown icon"></i>
        </div>
        <div class="ui link cards" style="overflow-x:hidden;max-height:350px; margin-top:20px; margin-bottom:20px">
            <router-link :to="{path: `${project}/${m.path}`}" class="card" v-for="m of projects" :key="m.path">
                <div class="content">
                    <img class="right floated mini ui icon" :src="m.icon">
                    <div class="header">
                        {{m.name}}
                    </div>
                    <span class="meta">
                        {{m.author}}
                    </span>
                    <div class="meta">
                        <span>
                            <i class="calendar icon"> </i>
                            {{m.date}}
                        </span>
                        <span>
                            <i class="download icon"></i>
                            {{m.count}}
                        </span>
                    </div>
                    <div class="description">
                        {{m.description}}
                    </div>
                </div>
                <div class="extra content">
                    <div class="ui avatar image" v-for="cat of m.categories" :key="cat.href">
                        <img :src="cat.icon">
                    </div>
                </div>
            </router-link>
        </div>
        <pagination :pages="pages" @page="change({page:$event})"></pagination>
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
    props: ['project'],
    methods: {
        // ...vuex.mapActions('curseforge', { fetchMods: 'mods' }),
        /**
         * @param {{path:string, version:string, filter:string}} payload 
         */
        fetch(payload) {
            const filter = payload.filter || this.filter;
            const version = payload.version || this.version;
            const page = payload.page || this.page;
            this.loading = true;
            console.log('project ' + this.project)

            return this.$store.dispatch(`curseforge/projects`, { project: this.project, page, version, sort: filter })
                // return this.fetchMods({ page, version, sort: filter })
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
