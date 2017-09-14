<template>
    <div>
        <div v-if="mods.length==0 || loading" class="ui active inverted dimmer">
            <div class="ui text loader">Loading</div>
        </div>
        <div id="filterDropdown" class="ui labeled icon top right pointing dropdown button">
            <i class="filter icon"></i>
            <span class="text">Popularity</span>
            <div class="menu">
                <div class="item">
                    Popularity
                </div>
                <div class="item">
                    Date Created
                </div>
                <div class="item">
                    Last Updated
                </div>
                <div class="item">
                    Name
                </div>
                <div class="item">
                    Total download
                </div>
            </div>
        </div>
        <div id="versionDropdown" class="ui labeled icon top right pointing scrolling dropdown button">
            <i class="filter icon"></i>
            <span class="text">Filter Posts</span>
            <div class="menu">
                <div class="item" v-for="v of versions" :key="v.value" @click="version = v.value">
                    {{v.text}}
                </div>
            </div>
        </div>
        <div class="ui divided items" style="overflow-x:hidden;max-height:350px">
            <div class="item" v-for="m of mods" :key="m.path">
                <div class="ui tiny image">
                    <img :src="m.icon">
                </div>
                <div class="content">
                    <div class="header">
                        {{m.name}}
                    </div>
                    <span class="meta">
                        &nbsp {{m.author}}
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
                    <div class="extra">

                    </div>
                </div>
            </div>
        </div>
        <div class="ui secondary pagination menu">
            <a class="item" :class="{active: p===page,  disabled: p==='...'}" v-for="p of pages" :key="p" @click="page = p">
                {{p}}
            </a>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            mods: [],
            page: 1,
            pages: [],
            version: '',
            filter: '',
            versions: [],
            loading: false,
        }
    },
    mounted() {
        if (this.mods.length === 0) this.request()
    },
    watch: {
        page() { this.request(); },
        filter() { this.page = 1; },
        version() { this.page = 1; },
    },
    methods: {
        request() {
            const args = { page: this.page, version: this.version, sort: this.filter }
            this.loading = true;
            const current = args ? args.page || 1 : 1;
            const self = this;
            this.$store.dispatch('query', { service: 'curseforge', action: 'mods', payload: args })
                .then(s => {
                    self.mods = s.mods;
                    const total = s.pages;

                    const start = Math.max(current - 2, 1)
                    const end = Math.min(current + 3, total);

                    const pages = []
                    if (start > 1) pages.push(1, '...');
                    for (let i = start; i < end; i++) pages.push(i);
                    if (end < total) pages.push('...', total)
                    self.page = current;
                    self.pages = pages
                    self.versions = s.versions;
                    self.$nextTick(() => {
                        $('#filterDropdown').dropdown()
                        $('#versionDropdown').dropdown()
                        this.loading = false;
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
