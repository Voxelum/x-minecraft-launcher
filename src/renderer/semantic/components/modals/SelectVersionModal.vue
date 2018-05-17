<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="user icon"></i>
            <label>{{$t('version.selectVersion')}}</label>
        </div>
        <div class="content">
            <label>{{$t('version.selectversionWarn')}}</label>
        </div>
        <div class="actions">
            <div class="ui basic inverted cancel button">{{$t('cancel')}}</div>
            <div class="ui basic inverted approve button">{{$t('ok')}}</div>
        </div>
    </div>
</template>

<script>
export default {
    mounted() { $(this.$el).modal({ blurring: true }) },
    methods: {
        show() {
            $(this.$el).modal('show');
        }
    }
}
</script>

<style>

</style>
