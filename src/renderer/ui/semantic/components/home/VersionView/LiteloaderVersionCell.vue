<template>
    <tr style="cursor: pointer;" :url="meta.url" @click="$emit('select', meta)">
        <td>
            <div class="ui ribbon label">{{meta.type}}</div>
            <br> {{meta.version}}
            <i v-if="selected" class="ui green check icon"></i>
        </td>
        <td>{{new Date(meta.timestamp * 1000).toUTCString()}}</td>
        <td class="selectable" :data-tooltip="$t(`version.${status}`)" data-position="left center" @click="$emit('download', meta)">
            <div style="padding:0 10px 0 10px;pointer-events: none;">
                <i :class="downloadIcon" v-if="meta.status!=='loading'"></i>
                <div class="ui active inline small loader" v-else></div>
            </div>
        </td>
    </tr>
</template>

<script>
export default {
    computed: {
        status() {
            return this.$store.getters['versions/liteloader/status'](this.meta.version);
        },
        downloadIcon() {
            return {
                download: this.status === 'remote',
                disk: this.status === 'local',
                outline: this.status === 'local',
                icon: true,
            }
        },
    },
    props: ['meta', 'selected'],
}
</script>

<style>

</style>
