<template>
    <div>
        <h5 class="ui horizontal divider header">
            <i class="plug icon"></i>
            <div class="content">
                {{selectingMeta.id}}
                <div class="sub header">{{selectingMeta.releaseTime}}</div>
                <div class="sub header">{{selectingMeta.type}}</div>
            </div>
        </h5>
        <div class="ui attached segment " :class="{disabled: metas.length==0}" style='height:220px;overflow-x: hidden;'>
            <div v-if="metas.length==0" class="ui active inverted dimmer">
                <div class="ui indeterminate text loader">{{$t('version.prepare')}}</div>
            </div>
            <table class="ui very basic selectable celled center aligned table">
                <tbody>
                    <tr style="cursor: pointer;" v-for="meta in metas" :key="meta" :url="meta.url" :version-id='meta.id' @click="onselect">
                        <td>
                            <div class="ui ribbon label">{{meta.type}}</div>
                            <br> {{meta.id}}
                        </td>
                        <td>{{meta.releaseTime}}</td>
                        <td>{{meta.time}}</td>
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
        <div class="ui clearing bottom attached segment">
            <!-- <div class="ui left icon input">
                    <i class="filter icon"></i>
                    <input>
                </div> -->
            <div class="ui right floated checkbox">
                <input type="checkbox" name="example">
                <label>Show Alpha</label>
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
        }
    },
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
            if (!this.filterRelease) return this.minecraft.versions
            return this.minecraft.versions.filter(v => v.type === 'release')
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


