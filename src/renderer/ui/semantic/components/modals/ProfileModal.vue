<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="user icon"></i>
            {{$t('user.profile')}}
        </div>
        <div>
            {{username}}
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    computed: {
        ...vuex.mapGetters('user', ['username'])
    },
    mounted() {
        $(this.$el).modal({ blurring: true })
    },
    methods: {
        show() {
            $(this.$el).modal('show')
        }
    }
}
</script>

<style>

</style>
