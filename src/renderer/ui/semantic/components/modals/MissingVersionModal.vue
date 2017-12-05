<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="user icon"></i>
            {{$t('version.missing', {version})}}
        </div>
        <div class="content">
            {{$t('version.requiredownload', {version})}}
        </div>
        <div class="actions">
            <div class="ui basic inverted cancel button">{{$t('cancel')}}</div>
            <div class="ui basic inverted approve button" @click="download">Download</div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    computed: {
        id() { return this.$route.params.id; },
        version() { return this.$store.getters[`profiles/${this.id}/mcversion`]; }
    },
    mounted() {
        $(this.$el).modal({ blurring: true })
    },
    methods: {
        show() { $(this.$el).modal('show'); },
        download() { this.$store.dispatch('versions/download', this.version); }
    }
}
</script>

<style>

</style>
