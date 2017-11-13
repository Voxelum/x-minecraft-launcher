<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="values.length===0" @drop="ondrop" style="height:100%">
        <br>
        <h2 class="ui icon header">
            <i class="game icon"></i>
            <div class="sub header">{{$t('mod.hint')}}</div>
        </h2>
    </div>
    <div v-else @drop="ondrop" class="ui grid">
        <div class="row">
            <div class="eight wide centered column">
                <div class="ui icon fluid transparent input">
                    <i class="filter icon"></i>
                    <input placeholder="Filter" v-model="keyword">
                </div>
            </div>
            <div class="eight wide centered column">
                <div class="ui icon fluid transparent input">
                    <i class="filter icon"></i>
                    <input placeholder="Filter" v-model="keyword">
                </div>
            </div>
        </div>
        <div class="row">
            <div class="eight wide column">
                <div class="ui relaxed divided items" style="height:290px; padding:0px 20px 0 0;overflow-x:hidden;overflow-x:hidden;">
                    <a class="ui circular large label" style="margin:5px" v-for="(val, index) in mods" v-if="valid(val)" :key="val[0].modid||val[0].name" :data-tooltip="val[0].version" data-inverted="" :data-position="pos(index)" @click="$bus.$emit('modal', 'moddetail', val[0])">
                        {{modName(val[0])}}
                    </a>
                </div>
            </div>
            <div class="eight wide column">
                <draggable class="ui relaxed divided items" style="height:290px; padding:0px 20px 0 0;overflow-x:hidden;overflow-x:hidden;">
                    <a class="ui circular large label" style="margin:5px" v-for="(val, index) in nonselectedMods" v-if="valid(val)" :key="val[0].modid||val[0].name" :data-tooltip="val[0].version" data-inverted="" :data-position="pos(index)" @click="$bus.$emit('modal', 'moddetail', val[0])">
                        {{modName(val[0])}}
                    </a>
                </draggable>
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
import ListCell from './ListCell'
import en from 'static/en-cn'

const generalized = {}
function general(w) {
    return w.replace(/ /g, '').toLowerCase()
}
for (const k in en) {
    generalized[general(k)] = en[k];
}

export default {
    data: () => ({
        keyword: '',
        showOtherVersion: false,
        disabledOnly: true,
        cached: [],
    }),
    components: { ListCell },
    computed: {
        id() { return this.$route.params.id },
        ...vuex.mapGetters('repository', { values: 'mods' }),
        selectedMods: {
            get() { return this.$store.getters[`profiles/${this.id}/forge/mods`] },
            set() { },
        },
        nonselectedMods: {
            get() { return this.mods },
            set() { },
        },
        mods() {
            // return this.values;
            const resources = this.values
            const tree = {}
            for (const resource of resources) {
                let meta = resource.meta instanceof Array ? resource.meta : [resource.meta];
                for (const resMeta of meta) {
                    if (!resMeta) continue;
                    const id = resMeta.id.substring(0, resMeta.id.indexOf(':'));
                    const metas = resMeta.meta instanceof Array ?
                        [...resMeta.meta] : [resMeta.meta]
                    if (!tree[id]) tree[id] = []
                    tree[id].push(...metas)
                }
            }
            return Object.keys(tree).map(k => tree[k])
        }
    },
    methods: {
        classObject: function (index) {
            const color = ['red', 'green', 'teal', 'orange', 'blue'][Math.floor(Math.random() * 5) % 5];
            return {
                [color]: true,
            }
        },
        ...vuex.mapActions('repository', ['import']),
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
        modName(m) {
            const name = m.modid || m.name;
            const gname = general(name)
            if (generalized[gname]) return generalized[gname];
            return name;
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
