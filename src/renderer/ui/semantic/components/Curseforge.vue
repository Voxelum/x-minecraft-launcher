<template>
    <div>
        <div v-if="mods.length==0 || loading" class="ui active inverted dimmer">
            <div class="ui text loader">Loading</div>
        </div>
        <div id="filterDropdown" class="ui labeled icon top right pointing basic dropdown">
            <i class="filter icon"></i>
            <span class="text">Popularity</span>
            <div class="menu">
                <div class="item" v-for="f of filters" :key="f.value" @click="change({filter: f.value})">
                    {{f.text}}
                </div>
            </div>
            <i class="dropdown icon"></i>
        </div>
        <div id="versionDropdown" class="ui labeled icon top right pointing scrolling basic dropdown">
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
            <router-link :to="{ path: 'curseforge/'+m.path, params:{id: m.path}}" class="card" v-for="m of mods" :key="m.path" style="padding-right:10px">
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
                            {{date(m.date)}}
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
        <div class="ui secondary pagination menu">
            <a class="item" :class="{active: p===page,  disabled: p==='...'}" v-for="p of pages" :key="p" @click="change({page: p})">
                {{p}}
            </a>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
export default {
    computed: {
        ...vuex.mapState('curseforge', ['mods', 'pages',
            'page', 'version', 'filter',
            'filters', 'versions', 'loading']),
    },
    mounted() {
        if (this.mods.length === 0) this.change()
        $('#filterDropdown').dropdown()
        $('#versionDropdown').dropdown()
    },
    created() {
        $('#filterDropdown').dropdown()
        $('#versionDropdown').dropdown()
    },
    methods: {
        ...vuex.mapActions('curseforge', ['update']),
        change({ page, version, filter } = {}) {
            if ((version || filter) && this.page !== 1) page = 1;
            const self = this;
            this.update({ page, version, filter }).then(() => {
                self.$nextTick(() => {
                    $('#filterDropdown').dropdown()
                    $('#versionDropdown').dropdown()
                })
            })
        },
        date(string) {
            const date = new Date(0)
            date.setUTCSeconds(Number.parseInt(string))
            return date.toLocaleDateString()
        }
    },
}
</script>

<style>

</style>
