<template>
    <span>
        <div class="ui icon right floated inverted button non-moveable" @click="onlaunch">
            &nbsp&nbsp&nbsp
            <i class="rocket icon"></i>
            {{$t('launch')}} &nbsp&nbsp&nbsp&nbsp
        </div>
        <div class="ui icon right floated inverted button non-moveable" @click="edit">
            <i class="edit icon"></i>
            {{$t('edit')}}
        </div>
    </span>
</template>

<script>
import vuex from 'vuex'

export default {
    computed: {
        id() { return this.$route.params.id },
        type() { return this.$store.getters[`profiles/${this.id}/type`] }
    },
    methods: {
        ...vuex.mapActions(['launch']),
        edit() {
            this.$ipc.emit('modal', this.type, { isEdit: true })
        },
        onlaunch() {
            this.launch(this.id).catch((e) => {
                const type = typeof e === 'string' ? e : e.type;
                console.error(e)
                switch (type) {
                    case 'missing.version':
                        this.$ipc.emit('modal', 'missingVersion')
                        break;
                    case 'profile.noversion':
                        this.$ipc.emit('modal', 'selectVersion')
                        break;
                    default:
                }
            })
        },
    },
}
</script>

<style>

</style>
