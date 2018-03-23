<template>
    <div class="ui small basic modal transition hidden">
        <i class="close icon"></i>
        <div class="ui icon header">
            <i class="map icon"></i>
            Delete Map
        </div>
        <div class="content">
            Are you sure to delete this map? This will remove all the data about this map in the disk!
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
    data: () => ({
        id: '',
        map: '',
    }),
    mounted() {
        const self = this
        $(this.$el).modal({
            blurring: true,
            onApprove($element) {
                self.$store.dispatch(`profiles/${self.id}/map/delete`, self.map)
                return true;
            },
        })
    },
    methods: {
        show({ id, map }) {
            this.id = id;
            this.map = map;
            $(this.$el).modal('show');
        }
    },
}
</script>

<style>

</style>
