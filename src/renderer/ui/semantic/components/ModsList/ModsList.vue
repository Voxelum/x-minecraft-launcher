<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="values.length===0" @drop="ondrop" style="height:100%">
        <br>
        <h2 class="ui icon header">
            <i class="game icon"></i>
            <div class="sub header">{{$t('mod.hint')}}</div>
        </h2>
    </div>
    <div v-else>
        <div class="ui grid">
            <div class="eight wide column">
                <div class="ui icon transparent input">
                    <i class="filter icon"></i>
                    <input placeholder="Filter" v-model="keyword">
                </div>
            </div>
            <div class="eight wide right aligned column">
                <div class="ui checkbox">
                    <input type="checkbox">
                    <label>Show Mods for other version</label>
                </div>
            </div>
        </div>
    
        <div class="ui divider"></div>
        <div class="ui relaxed divided items">
            <list-cell v-for="val in mods" :key="val" :value="val"></list-cell>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
import ListCell from './ListCell'

function valid(meta, keyword) { return meta.name.includes(keyword) || meta.modid.includes(keyword) || meta.description.includes(keyword) }
export default {
    data() {
        return {
            keyword: ''
        }
    },
    components: { ListCell },
    computed: {
        ...vuex.mapGetters('mods', ['values']),
        mods() {
            const all = []
            for (const val of this.values) {
                if (val.meta instanceof Array)
                    for (const meta of val.meta) {
                        if (valid(meta.meta, this.keyword))
                            all.push(meta)
                    }
                else if (valid(meta.meta, this.keyword))
                    all.push(val.meta)
            }
            return all
        }
    },
    props: ['id'],
    methods: {
        ...vuex.mapActions('mods', ['import']),
        ondrop(event) {
            this.import(event.dataTransfer.files[0].path)
            event.preventDefault()
        }
    }
}
</script>

<style>

</style>
