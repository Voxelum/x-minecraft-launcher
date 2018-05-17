<template>
    <div class="ui card" v-bind:class="{color}">
        <p class="ui top attached label" :data-tooltip="$tc(this.source.type + '.name', 1)" data-inverted="" :data-position="bound? 'bottom center': 'top center'">
            <i class="server icon"></i>
            {{host}}
            <i class="right floated large delete icon" :class="{red:hoverDelete}" @mouseover="hoverDelete=true" @mouseout="hoverDelete=false" @click="del"></i>
        </p>
        <div class="content" @click="onclick">
            <img :src="this.source.icon" class="right floated ui image">
            <div class="header">
                {{this.name}}
            </div>
            <div class="meta">
                <text-component :source="version" styled="false"></text-component>
                <!-- <span class="date">{{this.source.createdDate}}</span> -->
            </div>
            <div class="description" style="max-height:50px; overflow: auto;">
                <text-component :source="motd"></text-component>
            </div>
        </div>
        <div class="extra content">
            <span>
                <i class="users icon"></i> {{this.onlinePlayers}} / {{this.capacity}}</span>
            <div class="right floated">
                <i class="signal icon"></i>
                {{this.ping === -1 ? 'Cannot connected' : this.ping.toFixed(2) + ' ms'}}
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data: () => ({
        hoverDelete: false,
    }),
    computed: {
        name() { return this.source.name; },
        host() { return this.source.host; },
        port() { return this.source.port; },
        icon() { return this.source.status.favicon || '' },
        onlinePlayers() {
            return this.source.status.players ? this.source.status.players.online || -1 : -1
        },
        capacity() {
            return this.source.status.players ? this.source.status.players.max || -1 : -1
        },
        ping() { return this.source.status.ping || -1 },
        motd() { return this.source.status.description || '' },
        version() {
            return this.source.status.version ?
                this.source.status.version.name : 'Unknown'
        },

    },
    props: ['color', 'source', 'id', 'bound'],
    methods: {
        onclick(e) {
            this.$emit('select', this.id, this.source)
        },
        del(e) {
            this.$emit('delete', this.id, this.source)
            e.preventDefault()
        },
    },
    mounted() {
    },
}
</script>

<style>

</style>
