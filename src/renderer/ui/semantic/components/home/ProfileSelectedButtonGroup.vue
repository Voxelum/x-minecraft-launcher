<template>
    <span>
        <div class="ui icon right floated inverted button non-moveable" @click="onlaunch">
            &nbsp&nbsp&nbsp
            <i class="rocket icon"></i>
            {{$t('launch')}} &nbsp&nbsp&nbsp&nbsp
        </div>
        <div class="ui icon right floated inverted button non-moveable" @click="edit">
            <i class="edit icon"></i>
            Edit
        </div>
    </span>
</template>

<script>
import vuex from 'vuex'

export default {
    computed: {
        id() { return this.$route.params.id },
        profile() { return this.$store.getters[`profiles/get`](this.id) },
    },
    methods: {
        ...vuex.mapActions(['launch']),
        edit() {
            this.$bus.$emit('modal', this.profile.type, { isEdit: true })
        },
        onlaunch() {
            this.launch().catch((e) => {
                switch (e.type) {
                    case 'missing.version':
                        this.$bus.$emit('modal', 'missingVersion')
                    default:
                }
                console.log(e.type)
                console.log(e)
            })
        },
    },
}
</script>

<style>

</style>
