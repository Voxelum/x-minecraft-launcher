<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="values.length===0" @drop="ondrop" style="height:100%">
        <br>
        <h2 class="ui icon header">
            <i class="game icon"></i>
            <div class="sub header">{{$t('mod.hint')}}</div>
        </h2>
    </div>
    <div v-else @drop="ondrop">
        <div class="ui grid">
            <div class="eight wide column">
                <div class="ui icon transparent input">
                    <i class="filter icon"></i>
                    <input placeholder="Filter" v-model="keyword">
                </div>
            </div>
            <!-- <div id="modFilterDropdown" class="eight wide right aligned column">
                <select name="skills" multiple="" class="ui dropdown">
                    <option value="angular">OtherVersion</option>
                    <option value="css">Disabled Only</option>
                </select>
            </div> -->
        </div>
        <div  class="ui divider"></div>
        <virtualList wclass="ui relaxed divided items" :size="50" :remain="3" :bench="8" style="height:230px; padding:0px 20px 0 0;overflow-x:hidden;overflow-x:hidden;">
            <list-cell v-for="val in mods" v-if="valid(val)" :key="val[0].modid||val[0].name" :value="val"></list-cell>
        </virtualList>
    </div>
</template>

<script>
import vuex from 'vuex'
import ListCell from './ListCell'
import VirtualList from 'vue-virtual-scroll-list'

export default {
    data() {
        return {
            keyword: '',
            showOtherVersion: false,
            disabledOnly: true,
        }
    },
    components: { ListCell, VirtualList },
    computed: {
        ...vuex.mapGetters('mods', ['values']),
        selectedMods() { return this.$store.getters[`profiles/${this.id}/forge/mods`] },
        mods() {
            const resources = this.values
            const tree = {}
            for (const resource of resources) {
                let meta = resource.meta;
                if (!(meta instanceof Array))
                    meta = [meta];
                for (const resMeta of meta) {
                    if (!resMeta) continue;
                    let id = resMeta.id;
                    id = id.substring(0, id.indexOf(':'));
                    const metas = resMeta.meta instanceof Array ?
                        [...resMeta.meta] : [resMeta.meta]
                    if (!tree[id]) tree[id] = []
                    tree[id].push(...metas)
                }
            }
            return Object.keys(tree).map(k => tree[k])
        }
    },
    props: ['id'],
    methods: {
        ...vuex.mapActions('mods', ['import']),
        valid(metas) {
            const keyword = this.keyword;
            let valid = false;
            for (const meta of metas) {
                if ((meta.name && meta.name.includes(keyword))
                    || (meta.modid && meta.modid.includes(keyword))
                    || (meta.description && meta.description.includes(keyword)))
                    valid = true;
            }
            return valid;
        },
        ondrop(event) {
            if (event.dataTransfer && event.dataTransfer.files) {
                this.import(Array.from(event.dataTransfer.files).map(f => f.path))
            }
            event.preventDefault()
        }
    }
}
</script>

<style>

</style>
