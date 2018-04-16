<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="mods.length===0" @drop="ondrop">
        <br>
        <h2 class="ui icon header">
            <i class="game icon"></i>
            <div class="sub header">{{$t('mod.hint')}}</div>
        </h2>
    </div>
    <div v-else @drop="ondrop" class="ui grid" style="width:100%">
        <div class="row">
            <div class="eight wide centered column">
                <div class="ui icon fluid  input">
                    <i class="filter icon"></i>
                    <input :placeholder="$t('filter')" class="simple" v-model="nonSelectKeyword">
                </div>
            </div>
            <div class="eight wide centered column">
                <div class="ui icon fluid  input">
                    <i class="filter icon"></i>
                    <input :placeholder="$t('filter')" class="simple" v-model="selectKeyword">
                </div>
            </div>
        </div>
        <div class="row">
            <div class="eight wide column">
                <div class="ui relaxed divided items" style="max-height:230px; padding:0px 20px 0 0;overflow-x:hidden;overflow-x:hidden;">
                    <mod-label :notmatch="m.mcversion!==mcversion" v-for="(m, index) in nonselectedMods" :mod="m" :key="m.hash" :index='index' selecting='false' @toggle="addForgeMod(m)"></mod-label>
                </div>
            </div>
            <div class="eight wide column">
                <div class="ui relaxed divided items" style="max-height:230px; padding:0px 20px 0 0;overflow-x:hidden;overflow-x:hidden;">
                    <mod-label v-for="(m, index) in selectedMods" :mod="m" :key="m.hash" :index='index' selecting='true' @remove="removeForgeMod(m)"></mod-label>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
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
        nonSelectKeyword: '',
        selectKeyword: '',
        showOtherVersion: false,
        disabledOnly: true,
        cached: [],
    }),
    components: { ModLabel: () => import('./ModLabel') },
    computed: {
        id() { return this.$route.params.id },
        ...vuex.mapGetters('repository', ['mods']),
        mcversion() { return this.$store.getters[`profiles/${this.id}/mcversion`] },
        forgeModNames() { return this.$store.getters[`profiles/${this.id}/forge/selected`] },
        modIdVersions() {
            const modIdVersions = {};
            this.mods.forEach((res) => {
                res.meta.mods.forEach((mod) => {
                    const mInfo = {
                        hash: res.hash,
                        filename: res.name,
                        signiture: res.signiture,
                        type: mod.type,
                        ...mod.meta,
                    }
                    if (this.valid(this.selectKeyword, mInfo))
                        modIdVersions[`${mod.meta.modid}:${mod.meta.version}`] = mInfo
                })
            })
            return modIdVersions;
        },
        selectedMods() {
            return this.forgeModNames.map((id) =>
                this.modIdVersions[id]).filter(mod => mod !== undefined);
        },
        nonselectedMods() {
            const arr = [];
            console.log(this.mods);
            for (const resource of this.mods) {
                const metas = resource.meta.mods;
                metas.forEach((artifact) => {
                    const mInfo = {
                        hash: resource.hash,
                        filename: resource.name,
                        signiture: resource.signiture,
                        type: resource.type,
                        ...artifact.meta,
                    };
                    if (this.valid(this.nonSelectKeyword, mInfo))
                        arr.push(mInfo)
                })
            }

            return arr;
        },
    },
    methods: {
        classObject: function (index) {
            const color = ['red', 'green', 'teal', 'orange', 'blue']
            [Math.floor(Math.random() * 5) % 5];
            return {
                [color]: true,
            }
        },
        addForgeMod(mod) {
            this.$store.dispatch(`profiles/${this.id}/forge/add`,
                `${mod.modid}:${mod.version}`)
        },
        removeForgeMod(mod) {
            this.$store.dispatch(`profiles/${this.id}/forge/remove`,
                `${mod.modid}:${mod.version}`)
        },
        ...vuex.mapActions('repository', ['import']),
        valid(keyword, mod) {
            if (keyword === '') return true
            return (mod.name && mod.name.includes(keyword))
                || (mod.modid && mod.modid.includes(keyword))
                || (mod.description && mod.description.includes(keyword))
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
                    .catch((e) => {
                        console.error(e);
                    })
            }
            event.preventDefault()
        }
    }
}
</script>

<style>
.simple {
  border-top: none !important;
  border-left: none !important;
  border-right: none !important;
  border-radius: 0px !important;
}
</style>
