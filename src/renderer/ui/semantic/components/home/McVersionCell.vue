<template>
    <tr style="cursor: pointer;" :url="meta.url" :version-id='meta.id' @click="$emit('select', meta.id)">
        <td>
            <div class="ui ribbon label">{{meta.type}}</div>
            <br> {{meta.id}}
            <i v-if="selected" class="ui green check icon"></i>
        </td>
        <td>{{meta.releaseTime}}</td>
        <td class="selectable" :data-tooltip="$t(`version.${meta.status}`)" data-position="left center" @click="$emit('download', meta.id)">
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
        downloadIcon() {
            return {
                download: this.meta.status === 'remote',
                disk: this.meta.status === 'local',
                outline: this.meta.status === 'local',
                icon: true,
            }
        },
    },
    props: ['meta', 'selected'],
}
</script>

<style>

</style>
