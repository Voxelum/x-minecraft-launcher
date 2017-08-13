<template>
    <div>
        <div class="ui list">
            <div class="ui item input" v-for="m in maps" :key="m.name">
                {{m.name}} : {{m.list}}
                <input :value="m.name" @blur="modify"></input>
            </div>
    
        </div>
        <div class="ui button" @click="add('test')">
            Add
        </div>
    </div>
</template>

<script>

let first = true
let val = 0
export default {
    computed: {
        maps() {
            return this.$store.state.profiles[this.id].minecraft.maps
        },
    },
    props: ['source', 'id'],
    methods: {
        add(name) {
            this.$store.commit(`profiles/${this.id}/minecraft/addMap`, { map: { name, list: [] } })
        },
        modify(event) {
            const m = this.$store.state.profiles[this.id].minecraft.maps[0]
            this.$store.commit(`profiles/${this.id}/minecraft/modifyMap`, {
                map: m,
                key: 'name',
                value: event.target.value,
            })
            val++
            this.$store.commit(`profiles/${this.id}/minecraft/pushMapList`, {
                map: m,
                key: 'list',
                value: {
                    test: `oldVal${val}`
                }
            })
            first = false;
            console.log(m)
        },
    }
}
</script>

<style>

</style>
