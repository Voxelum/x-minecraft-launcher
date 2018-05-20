<template>
    <div class="ui fluid search dropdown selection multiple visible" @click="focusInput">
        <a class="ui label transition visible" v-for="label in labels" :key="label" style="display: inline-block !important;">
            {{label}}
            <i class="delete icon" @click="delLabel(label)"></i>
        </a>
        <input ref="input" class="search" autocomplete="" tabindex="0" @keypress.enter="newLabel" v-model="inputVal" style="min-width:80px">
        <span class="sizer">{{inputVal}}</span>
    </div>
</template>

<script>
export default {
    data: () => ({
        inputVal: '',
    }),
    methods: {
        newLabel() {
            if (this.inputVal === '') return;
            if (this.labels.indexOf(this.inputVal) !== -1) {
                this.inputVal = '';
                return;
            }
            this.$emit('addlabel', this.inputVal)
            this.inputVal = '';
        },
        delLabel(lab) {
            const idx = this.labels.indexOf(lab)
            if (idx === -1) return;
            this.$emit('dellabel', lab)
        },
        focusInput() {
            this.$refs.input.focus();
        },
    },
    props: {
        labels: {
            type: Array,
            default: () => [],
        },
    }
}
</script>

<style>

</style>
