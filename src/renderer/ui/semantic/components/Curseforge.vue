<template>
    <div class="ui divided items" style="overflow-x:hidden;height:100%" v-if="mods.length!==0">
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
    <div v-else class="ui active inverted dimmer">
        <div class="ui text loader">Loading</div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            mods: [],
            page: 0,
            total: 1,
        }
    },
    mounted() {
        const self = this;
        this.$store.dispatch('query', { service: 'curseforge', action: 'mods' })
            .then(s => {
                self.mods = s.mods;
                self.total = s.pages
            })
    },
    methods: {
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
