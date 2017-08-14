<template>
    <div>
        <div class="ui button" @click="importMap">
            Import
        </div>
        <div class="ui button" @click="exportMap">
            Exprot
        </div>
        <div class="ui button" @click="copyTo">
            CopyTo
        </div>
        <div class="ui list">
            <div draggable="true" class="ui item input" v-for="m in maps" :key="m.name">
                {{m.name}} : {{m.list}}
                <input :value="m.name" @blur="modify"></input>
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'
import types from '@/store/types'
export default {
    props: ['source', 'id'],
    methods: {
        exportMap(event) { },
        exportMap(event) { },
        modify(event) {
        },
        copyTo(event) { },
    },
}
</script>

<style>

</style>
