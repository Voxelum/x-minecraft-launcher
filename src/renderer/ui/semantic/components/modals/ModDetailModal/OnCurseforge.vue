<template>
     <div v-html="content"></div>
</template>

<script>
export default {
    computed: {
        content() {
            console.log(this.mod)
            if (this.mod.signiture && this.mod.signiture.source === 'curseforge') {
                return this.mod.signiture.meta.description;
            }
            return ''
        },
    },
    props: ['mod']
}
</script>

<style>

</style>
