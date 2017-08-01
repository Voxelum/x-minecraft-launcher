<template>
    <div class="ui grid">
        <div class="eight wide column">
            <h1 class="ui header">
                <img v-if="status.icon!=''&& status.icon" class="ui circular image" :src="status.icon">
                <div class="content">
                    <div class="ui transparent input" style="width:200px">
                        <input type="text" name="Name" :placeholder="id" :value="source.name" @blur="modify">
                    </div>
                    <h2 class="ui sub header">
                        <text-component :source="status.gameVersion"></text-component>
                        Players: {{status.onlinePlayers}}/{{status.capacity}}
                        <br> Pings: {{status.pingToServer}} ms
                    </h2>
                </div>
            </h1>
            <div class="ui text segment">
                <text-component :source="status.serverMOTD"></text-component>
            </div>
            <div style="height:202px"></div>
        </div>
        <div class="eight wide column">
        </div>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import TextComponent from '../TextComponent'
export default {
    components: { TextComponent },
    props: ['source', 'id'],
    computed: {
        status() { return this.source.status },
        type() { return this.source.type },
    },
    methods: {
        modify(event) {
            this.$store.commit('profiles/' + this.id + '/set' + event.target.name, event.target.value)
        },
        refresh() {
            this.$store.dispatch(`profiles/${this.id}/refresh`)
        },
    },
    mounted() {
    },
}
</script>

<style>

</style>
