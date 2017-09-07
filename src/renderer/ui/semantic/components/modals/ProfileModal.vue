<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="user icon"></i>
            {{$t('profile.name')}}
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
        ...vuex.mapGetters('auth', ['username'])
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
