<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="values.length===0" @drop="ondrop" style="height:100%">
        <br>
        <h2 class="ui icon header">
            <i class="game icon"></i>
            <div class="sub header">{{$t('mod.hint')}}</div>
        </h2>
    </div>
    <div v-else @drop="ondrop" class="ui grid">
        <div class="row"></div>
        <div class="ui icon transparent input">
            <i class="filter icon"></i>
            <input placeholder="Filter" v-model="keyword">
        </div>
        <div class="row">
            <div class="eight wide column">
                <div class="ui relaxed divided items" style="height:290px; padding:0px 20px 0 0;overflow-x:hidden;overflow-x:hidden;">
                    <a class="ui circular large basic label" style="margin:5px" v-for="(val, index) in mods" v-if="valid(val)" :class="classObject(index)" :key="val[0].modid||val[0].name" :data-tooltip="val[0].description" data-inverted="" :data-position="pos(index)">
                        {{val[0].modid||val[0].name}}
                    </a>
                    <!-- <list-cell v-for="(val, index) in cached" v-if="valid(val)" :key="val[0].modid||val[0].name" :value="val"></list-cell> -->
                </div>
            </div>
            <div class="eight wide column">
            </div>
        </div>
        <!-- <div class="ui black grid"> -->
        <!-- <div class="eight wide column"> -->

        <!-- </div> -->
        <!-- <div id="modFilterDropdown" class="eight wide right aligned column">
                        <select name="skills" multiple="" class="ui dropdown">
                            <option value="angular">OtherVersion</option>
                            <option value="css">Disabled Only</option>
                        </select>
                    </div> -->
        <!-- </div> -->
        <!-- <div class="ui divider"></div> -->
        <!-- <virtualList wclass="ui relaxed divided items" :size="50" :remain="3" :bench="8" style="height:230px; padding:0px 20px 0 0;overflow-x:hidden;overflow-x:hidden;"> -->

        <!-- </virtualList> -->
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
            cached: [],
        }
    },
    mounted() {
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
                    let id = resMeta.id ? resMeta.id : resMeta.meta.modid || resMeta.meta.name;
                    if (resMeta.id) id = id.substring(0, id.indexOf(':'));
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
        classObject: function(index) {
            const color = ['red', 'green', 'teal', 'orange', 'blue'][Math.floor(Math.random() * 5) % 5];
            return {
                [color]: true,
            }
        },
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
        pos(index) {
            return index > 7 ? 'top center' : 'bottom center'
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
