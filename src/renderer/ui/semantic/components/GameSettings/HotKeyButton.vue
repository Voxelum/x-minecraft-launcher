<template>
    <div class="ui basic button" @click="onclick" @keyup="onkeypress">
        {{name}}: {{editing? 'Please press a key': innerkey}}
    </div>
</template>

<script>
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
            }
        })
    },
}
</script>

<style>

</style>
