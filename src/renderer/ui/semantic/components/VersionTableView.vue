<template>
    <div class="ui flowing popup bottom left transition hidden grid">
        <div class="sixteen wide center aligned column">
            <div class="ui left icon right action input">
                <i class="search icon"></i>
                <input type="text" placeholder="Filter" v-model="filter">
                <span id="alphaDropdown" class="ui basic floating dropdown button">
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
            <div class="ui basic segment " :class="{disabled: metas.length==0}" style='height:300px;overflow-x: hidden;'>
                <div v-if="metas.length==0" class="ui active inverted dimmer">
                    <div class="ui indeterminate text loader">{{$t('version.prepare')}}</div>
                </div>
                <table class="ui  very basic selectable celled center aligned table" style='height:300px;overflow-x: hidden;'>
                    <tbody>
                        <tr style="cursor: pointer;" v-for="meta in metas" :key="meta" :url="meta.url" :version-id='meta.id' @click="onselect">
                            <td>
                                <div class="ui  grey ribbon label">{{meta.type}}</div>
                                <br> {{meta.id}}
                            </td>
                            <td>{{meta.releaseTime}}</td>
                            <!-- <td>{{meta.time}}</td> -->
                            <td class="selectable" :ver="meta.id" :data-tooltip="$t('version.download')" data-position="left center" @click="ondownload" v-if="meta.status=='remote'">
                                <div style="padding:0 10px 0 10px;pointer-events: none;">
                                    <i class="download icon"></i>
                                </div>
                            </td>
                            <td class="selectable" :ver="meta.id" :data-tooltip="$t('version.downloaded')" data-position="left center" v-else-if="meta.status=='local'">
                                <div style="padding:0 10px 0 10px;pointer-events: none;">
                                    <i class="disk outline icon"></i>
                                </div>
                            </td>
                            <td :ver="meta.id" :data-tooltip="$t('version.downloading')" data-position="left center" v-else>
                                <div style="padding:0 15px 0 5px;pointer-events: none;">
                                    <div class="ui active inline small loader"></div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
<script>
import { mapGetters, mapState } from 'vuex'
export default {
    data() {
        return {
            filterRelease: true,
            filter: '',
            filterType: 'release',
        }
    },
    mounted() { $('#alphaDropdown').dropdown() },
    props: ['id'],
    computed: {
        ...mapState('versions', ['minecraft']),
        metaMap() {
            const map = new Map()
            for (const v of this.minecraft.versions)
                map.set(v.id, v);
            return map;
        },
        selectingMeta() { return /* this.metaMap.get(this.selected.version) || */ {}; },
        metas() {
            let metas = this.minecraft.versions;
            if (this.filterType !== '')
                metas = metas.filter(v => v.type === this.filterType)
            if (this.filter !== '')
                metas = metas.filter(v => v.id.includes(this.filter))
            return metas
        }
    },
    methods: {
        onselect(event) {
            const vId = event.srcElement.parentNode.getAttribute('version-id')
            if (vId != this.selectingVersion)
                this.$store.commit(`profiles/${this.id}/minecraft/version`, vId)
        },
        ondownload(event) {
            this.$store.dispatch('versions/download', this.metaMap.get(event.target.getAttribute('ver')))
            return false
        }
    },
    components: {}
}
</script>
<style>
::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
}

::-webkit-scrollbar-thumb {
    -webkit-border-radius: 10px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.25);
}

::-webkit-scrollbar-thumb:window-inactive {
    background: rgba(0, 0, 0, 0.2);
}
</style>


