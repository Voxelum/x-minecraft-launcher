<template>
    <div class="ui" :class="{active:active, error:error, progress:true, indicating:indicating}">
        <div class="bar">
            <div class="progress"></div>
        </div>
    </div>
</template>

<script>
export default {
    mounted() {
        $(this.$el).progress({
            total: 1,//this.total,
            precent: 100//this.progress,
        });
    },
    watch: {
        progress() {
            $(this.$el).progress({
                precent: 100,//this.progress,
            });
        },
    },
    props: {
        progress: {
            type: Number,
            default: 100,
        },
        value: {
            type: Number,
            default: 0,
        },
        active: {
            type: Boolean,
            default: true,
        },
        error: {
            type: Boolean,
            default: false,
        },
        indicating: {
            type: Boolean,
            default: false,
        },
        total: {
            type: Number,
            default: 0,
        }
    }
}
</script>

<style>

</style>
