<template>
    <h5 class="ui pointing dropdown">
        <i class="user icon"></i>
        {{username}}
        <i class="dropdown icon"></i>
        <div class="menu">
            <div class="item" @click="$bus.$emit('modal','profile')">
                <i class="id card outline icon"></i> {{$t('user.profile')}}
            </div>
            <div class="item" @click="$bus.$emit('modal','login')">
                <i class="sign out icon"></i> {{$t('user.logout')}}
            </div>
        </div>
    </h5>
</template>

<script>
import { mapGetters } from 'vuex'
export default {
    computed:{
        ...mapGetters('auth',['username']),
    },
    mounted() {
        $(this.$el).dropdown({ on: 'hover' })
    },
}
</script>

<style>

</style>
