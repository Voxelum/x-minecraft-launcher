<template>
    <div class="ui center aligned middle aligned basic segment container" v-if="values.length===0">
        <br>
        <h2 class="ui icon header">
            <i class="game icon"></i>
            <div class="sub header">{{$t('mod.hint')}}</div>
        </h2>
    </div>
    <div v-else>
        <div class="ui icon input">
            <i class="filter icon"></i>
            <input placeholder="Filter">
        </div>
        <h5 class="ui horizontal divider header">
            <i class="disk outline icon"></i>
            Mods
        </h5>
        <div class="ui relaxed list">
        </div>
    </div>
    <!-- </div>
                                        <div class="eight wide column">
                                            <h5 class="ui horizontal divider header">
                                                <i class="folder outline icon"></i>
                                                {{$t('resourcepack.selected')}}
                                            </h5>
                                            <div class="ui relaxed list">
                                                <list-cell v-for="entry in selecting" :key="entry.key" :entry="entry" type="remove" @change="remove"></list-cell>
                                            </div>
                                        </div>
                                    </div> -->
</template>

<script>
import vuex from 'vuex'


export default {
    computed: {
        ...vuex.mapGetters('mods', ['values'])
    },
    props: ['id']
}
</script>

<style>

</style>
