<template>
    <div>
    </div>
</template>

<script>
export default {
    mounted() {
        this.$store.dispatch('query', { service: 'curseforge', action: 'mods' })
            .then(s => {
                console.log(s)
            })
    }
}
</script>

<style>

</style>
