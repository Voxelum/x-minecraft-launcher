<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="user icon"></i>
            {{$t('version.missing', {version, type})}}
        </div>
        <div class="content">
            {{$t('version.requiredownload', {version, type})}}
        </div>
        <div class="actions">
            <div class="ui basic inverted cancel button">{{$t('cancel')}}</div>
            <div class="ui basic inverted approve button" @click="download">{{$t('download')}}</div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    data: () => ({
        type: '',
        version: '',
    }),
    computed: {
    },
    mounted() {
        $(this.$el).modal({ blurring: true })
    },
    methods: {
        show({ version, type }) {
            this.type = type;
            this.version = version;
            $(this.$el).modal('show');
        },
        download() {

        },
    },
}
</script>

<style>

</style>
