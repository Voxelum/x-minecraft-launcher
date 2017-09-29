<template>
    <div>
        <div v-if="mods.length==0 || loading" class="ui active inverted dimmer">
            <div class="ui text loader">Loading</div>
        </div>
        <div ref="filterDropdown" class="ui labeled icon top right pointing basic dropdown">
            <i class="filter icon"></i>
            <span class="text">Popularity</span>
            <div class="menu">
                <div class="item" v-for="f of filters" :key="f.value" @click="change({filter: f.value})">
                    {{f.text}}
                </div>
            </div>
            <i class="dropdown icon"></i>
        </div>
        <div ref="versionDropdown" class="ui labeled icon top right pointing scrolling basic dropdown">
            <i class="filter icon"></i>
            <span class="text">All Versions</span>
            <div class="menu">
                <div class="item" v-for="v of versions" :key="v.value" @click="change({version:v.value})">
                    {{v.text}}
                </div>
            </div>
            <i class="dropdown icon"></i>
        </div>
        <div class="ui link cards" style="overflow-x:hidden;max-height:350px; margin-top:20px; margin-bottom:20px">
            <router-link :to="{ path: 'curseforge/'+m.path, params:{id: m.path}}" class="card" v-for="m of mods" :key="m.path">
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
import Pagination from './Pagination'
export default {
    components: { Pagination },
    computed: {
        ...vuex.mapState('curseforge', ['mods', 'pages',
            'page', 'version', 'filter',
            'filters', 'versions', 'loading']),
    },
    mounted() {
        if (this.mods.length === 0) this.change()
        $(this.$refs.filterDropdown).dropdown()
        $(this.$refs.versionDropdown).dropdown()
    },
    created() {
        $(this.$refs.filterDropdown).dropdown()
        $(this.$refs.versionDropdown).dropdown()
    },
    methods: {
        ...vuex.mapActions('curseforge', ['projects']),
        change({ page, version, filter } = {}) {
            if ((version || filter) && this.page !== 1) page = 1;
            const self = this;
            this.projects({ page, version, filter }).then(() => {
                self.$nextTick(() => {
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
