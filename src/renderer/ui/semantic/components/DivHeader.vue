<template>
    <h5 class="ui horizontal divider header" data-position="bottom center" style="cursor:pointer">
        <slot></slot>
    </h5>
</template>

<script>
export default {
    mounted() {
        $(this.$el).popup({
            hoverable: true,
            delay: {
                show: 300,
                hide: 300
            },
        })
    }
}
</script>

<style>

</style>
