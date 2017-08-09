<template>
    <div class="ui basic button" @click="switchValue">
        {{localizedId}} : {{localizedValue}}
    </div>
</template>

<script>
export default {
    data() {
        return {
            selected: 0,
        }
    },
    computed: {
        localizedId() { return this.$t(`${this.id}.name`) },
        localizedOptions() { return this.options.map(v => `${this.id}.${v}`).map(v => this.$t(v)) },
        localizedValue() { return this.localizedOptions[this.selected] },
        value() { return this.options ? this.options[this.selected] : '' }
    },
    props: ['id', 'options'],
    methods: {
        switchValue() {
            this.selected = (this.selected + 1) % this.options.length
            this.$emit('change', this.value)
        }
    }
}
</script>

<style>

</style>
