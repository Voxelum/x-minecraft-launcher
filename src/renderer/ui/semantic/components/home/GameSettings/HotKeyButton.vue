<template>
    <button class="ui basic button" @click="onclick" @keyup="onkeypress" @blur="onblur" >
        {{name}}: {{editing? 'Please press a key': innerkey}}
    </button>
</template>

<script>
import keymapper from 'shared/keymapper'

export default {
    data: () => ({
        editing: false,
        innerkey: ''
    }),
    methods: {
        onclick() {
            this.editing = true
            //
        },
        onkeypress(event) {
            console.log(event);
            if (this.editing) {
                this.editing = false;
            }
        },
        onblur() {
            console.log('blur')
            this.editing = false;
        }
    },
    computed: {
    },
    props: ['initkey', 'name'],
    mounted() {
        this.innerkey = this.initkey;
        document.addEventListener('keypress', (event) => {
            if (this.editing) {
                this.editing = false;
                this.innerkey = event.key;
                this.$emit('keychange', this.innerkey)
                console.log(keymapper.getKey(event.code))
            }
        })
    },
}
</script>

<style>

</style>
