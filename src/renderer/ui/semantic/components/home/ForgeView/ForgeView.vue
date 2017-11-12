<template>
    <div>
        <div>
            HELLO {{version}}
        </div>
        <div class="ui list">
            <div v-for="mod of mods" :key="mod">
                {{mod}}
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
export default {
    computed: {
        id() { return this.$route.params.id; },
        version() { return this.$store.getters[`profiles/${this.id}/forge/version`] },
        settings() { return this.$store.getters[`profiles/${this.id}/forge/settings`] },
        mods() { return this.$store.getters[`profiles/${this.id}/forge/mods`] },
    }
}
</script>

<style>

</style>
