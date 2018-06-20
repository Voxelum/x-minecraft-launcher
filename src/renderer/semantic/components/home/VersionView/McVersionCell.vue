<template>
    <tr style="cursor: pointer;" :url="meta.url" :version-id='meta.id' @click="$emit('select', meta.id)">
        <td>
            <div class="ui ribbon label">{{meta.type}}</div>
            <br> {{meta.id}}
            <i v-if="selected" class="ui green check icon"></i>
        </td>
        <td>{{meta.releaseTime}}</td>
        <td class="selectable" :data-tooltip="$t(`version.${status}`)" data-position="left center" @click="onDownload">
            <div style="padding:0 10px 0 10px;pointer-events: none;">
                <i :class="downloadIcon" v-if="status!=='loading'"></i>
                <div class="ui active inline small loader" v-else></div>
            </div>
        </td>
    </tr>
</template>

<script>
export default {
    computed: {
        downloadIcon() {
            return {
                download: this.status === 'remote',
                disk: this.status === 'local',
                outline: this.status === 'local',
                icon: true,
            }
        },
        status() {
            return this.$store.getters['versions/minecraft/status'](this.meta.id);
        },
    },
    methods: {
        onDownload(event) {
            this.$emit('download', this.meta.id);
            event.stopPropagation();
            return true;
        },
    },
    props: ['meta', 'selected'],
}
</script>

<style>

</style>
