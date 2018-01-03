<template>
    <div class="row" style="max-height:150px;min-height:150px;">
        <div class="eight wide column">
            <h1 class="ui header">
                <img v-if="status.icon!=''&& status.icon" class="ui image" :src="status.icon">
                <i v-else class="server icon"></i>
                <div class="content">
                    {{name}}
                    <h2 class="ui sub header">
                        <text-component :source="status.gameVersion" localized="true"></text-component>
                    </h2>
                    <h2 class="ui sub header">
                        {{$t('server.players')}}: {{status.onlinePlayers}}/{{status.capacity}}
                    </h2>
                    <h3 class="ui sub header">
                        {{$t('server.pings')}}: {{status.pingToServer}} ms
                    </h3>
                </div>
            </h1>
        </div>
        <div class="eight wide column">
            <h5 class="ui horizontal divider header">
                <i class="tag icon"></i>
                {{$t('server.motd')}}
            </h5>
            <text-component :source="status.serverMOTD" localized="true"></text-component>
        </div>
    </div>
</template>

<script>

export default {
    computed: {
        status() { return this.$store.getters[`profiles/${this.id}/status`] },
        name() { return this.$store.getters[`profiles/${this.id}/name`] },

        id() { return this.$route.params.id }
    },
    methods: {
        refresh(force) {
            this.$store.dispatch(`profiles/${this.id}/refresh`, force)
        },
    },
    mounted() {
        if (!this.id) throw new Error('Unexpected state for undefined id!')
    },
}
</script>

<style scoped=true>
.ui.tab {
  height: 100%;
}
</style>
