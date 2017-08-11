<template>
    <div class="ui small basic modal transition hidden">
        <i class="close icon"></i>
        <div class="ui icon header">
            <i class="archive icon"></i>
            <p v-if="type!=''"> {{$t(`${type}.delete.name`)}}</p>
        </div>
        <div class="content">
            <p v-if="type!=''">{{$t(`${type}.delete.description`)}}</p>
        </div>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>{{$t('delete.no')}}</div>
            <div class="ui red basic inverted ok button">
                <i class="remove icon"></i>{{$t('delete.yes')}}</div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            type: '',
            id: '',
        }
    },
    mounted() {
        const self = this
        $(this.$el).modal({
            blurring: true,
            onApprove($element) {
                self.$emit('accept', self.id)
                return true;
            },
        })
    },
    methods: {
        show({ type, id }) {
            this.type = type;
            this.id = id;
            $(this.$el).modal('show');
        }
    },
}
</script>

<style>

</style>
