<template>
    <div class="row" style="max-height:150px;min-height:150px;">
        <div class="eight wide column">
            <h1 class="ui header">
                <img v-if="icon!=''&& icon" class="ui image" :src="icon">
                <i v-else class="server icon"></i>
                <div class="content">
                    {{name}}
                    <h2 class="ui sub header">
                        <text-component :source="version" localized="true"></text-component>
                    </h2>
                    <h2 class="ui sub header">
                        {{$t('server.players')}}: {{onlinePlayers}}/{{capacity}}
                    </h2>
                    <h3 class="ui sub header">
                        {{$t('server.pings')}}: {{ping}} ms
                    </h3>
                </div>
            </h1>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="tag icon"></i>
                {{$t('server.motd')}}
            </h5>
            <text-component :source="motd" localized="true"></text-component>
        </div>
    </div>
</template>

<script>
export default {
    computed: {
        icon() { return this.status.favicon || '' },
        onlinePlayers() {
            return this.status.players ? this.status.players.online || -1 : -1
        },
        capacity() {
            return this.status.players ? this.status.players.max || -1 : -1
        },
        ping() { return this.status.ping || -1 },
        motd() { return this.status.description || '' },
        version() {
            return this.status.version ?
                this.status.version.name : 'Unknown'
        },
        name() {
            return this.$store.getters[`profiles/${this.$route.params.id}/name`]
        },
        status() {
            return this.$store.getters[`profiles/${this.$route.params.id}/status`]
        },
    }
}
</script>

<style>

</style>
