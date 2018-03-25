<template>
    <div class="sixteen wide center aligned column">
        <div class="ui left icon right action input">
            <i class="search icon"></i>
            <input type="text" placeholder="Filter" v-model="filter">
            <span ref="alphaDropdown" class="ui basic floating dropdown button">
                <div class="text">{{$t('version.release')}}</div>
                <i class="dropdown icon"></i>
                <div class="menu">
                    <div class="item" @click="filterType='snapshot'">{{$t('version.snapshot')}}</div>
                    <div class="item" @click="filterType='release'">{{$t('version.release')}}</div>
                    <div class="item" @click="filterType=''">{{$t('version.all')}}</div>
                </div>
            </span>
        </div>
        <div class="ui divider"></div>
        <div class="ui basic segment " :class="{disabled: metas.length==0}" style='overflow-x: hidden; max-height:300px'>
            <div v-if="metas.length==0" class="ui active inverted dimmer">
                <div class="ui indeterminate text loader">{{$t('version.prepare')}}</div>
            </div>
            <table class="ui very basic selectable celled center aligned table" style='overflow-x: hidden;'>
                <tbody>
                    <tr style="cursor: pointer;" v-for="meta in metas" :key="meta.id" :url="meta.url" :version-id='meta.id' @click="onselect(meta.id)">
                        <td>
                            <div class="ui ribbon label">{{meta.type}}</div>
                            <br> {{meta.id}}
                        </td>
                        <td>{{meta.releaseTime}}</td>
                        <td class="selectable" :data-tooltip="$t(`version.${meta.status}`)" data-position="left center" @click="ondownload(meta.id)">
                            <div style="padding:0 10px 0 10px;pointer-events: none;">
                                <i :class="downloadIcon(meta.status)" v-if="meta.status!=='loading'"></i>
                                <div class="ui active inline small loader" v-else></div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
<script>
import { mapGetters, mapState } from 'vuex'
export default {
    data: () => ({
        filterRelease: true,
        filter: '',
        filterType: 'release',
    }),
    mounted() { $(this.$refs.alphaDropdown).dropdown() },
    computed: {
        id() { return this.$route.params.id },
        selectingVersion() { return this.$store.getters[`profiles/${this.id}/mcversion`] },
        ...mapGetters('versions', ['versions', 'latestRelease', 'latestSnapshot', 'versionsMap']),
        metas() {
            let metas = this.versions;
            if (this.filterType !== '')
                metas = metas.filter(v => v.type === this.filterType)
            if (this.filter !== '')
                metas = metas.filter(v => v.id.includes(this.filter))
            return metas
        }
    },
    methods: {
        downloadIcon: (status) => ({
            download: status === 'remote',
            disk: status === 'local',
            outline: status === 'local',
            icon: true,
        }),
        onselect(vId) {
            this.$store.dispatch(`profiles/${this.id}/edit`, { mcversion: vId })
        },
        ondownload(event) {
            console.log('download')
            console.log(this.versionsMap[event])
            if (!this.versionsMap[event]) {
                console.error(`Cannot find the remote version ${event}`)
            }
            if (this.versionsMap[event].status === 'remote')
                this.$store.dispatch('versions/download', this.versionsMap[event])
            return false
        }
    },
    components: {}
}
</script>
<style>

</style>
