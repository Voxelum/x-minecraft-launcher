<template>
    <div class="ui button" @click="switchValue">
         {{$t(id)}} : {{$t(value)}} 
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
