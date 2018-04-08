<template>
    <div class="ui basic button" @click="switchValue">
        {{localizedId}} : {{localizedValue}}
    </div>
</template>

<script>
export default {
    data: () => ({
        selected: 0,
    }),
    computed: {
        localizedId() { return this.$t(`${this.id}.name`) },
        localizedOptions() { return this.options.map(v => `${this.id}.${v}`).map(v => this.$t(v)) },
        localizedValue() { return this.localizedOptions[this.selected] },
    },
    props: ['id', 'options', 'value'],
    methods: {
        switchValue() {
            this.selected = (this.selected + 1) % this.options.length
            this.$emit('change', { [this.id]: this.options[this.selected] })
        }
    },
    mounted() {
        this.selected = this.options.indexOf(this.value)
    }
}
</script>

<style>

</style>
