<template>
    <h5 class="ui pointing dropdown" @drag="$event.preventDefault()">
        <i class="user icon"></i>
        {{username}}
        <i class="dropdown icon"></i>
        <div class="menu">
            <div :class="{disabled : offline}" class="item" @click="$ipc.emit('modal','profile')">
                <i class="id card outline icon"></i> {{$t('user.profile')}}
            </div>
            <div class="item" @click="$ipc.emit('modal','login')">
                <i class="sign out icon"></i> {{$t('user.logout')}}
            </div>
        </div>
    </h5>
</template>

<script>
import { mapGetters } from 'vuex'
export default {
    computed: {
        ...mapGetters('user', ['username']),
        offline() {
            return this.$store.getters['user/mode'] === 'offline';
        }
    },
    methods: {
        logout() {
            this.$store.dispatch('user/logout')
                .then(() => {
                    this.$nextTick(() => $ipc.emit('modal', 'login'))
                })
        },
    },
    mounted() {
        $(this.$el).dropdown({ on: 'hover' })
    },
}
</script>

<style>

</style>
