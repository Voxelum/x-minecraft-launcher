<template>
    <span>
        <div class="ui icon right floated inverted button non-moveable" @click="launch">
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
        selectedProfile() {
            return this.$store.state.profiles[this.id];
        }
    },
    methods: {
        ...vuex.mapActions(['launch']),
        edit() {
            const args = { isEdit: true }
            if (this.selectedProfile.type === 'server') {
                args.host = this.selectedProfile.host;
                args.port = this.selectedProfile.port;
                args.name = this.selectedProfile.name;
            } else {
                args.name = this.selectedProfile.name;
                args.author = this.selectedProfile.author;
                args.description = this.selectedProfile.description;
            }
            $emit('modal', this.selectedProfile.type, args);
        }
    },
    props: ['id'],
}
</script>

<style>

</style>
