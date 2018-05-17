<template>
    <div class="ui menu" style="z-index:10; position: absolute; visibility: hidden; max-height:2px; max-width:2px">
        <div ref="drop" class="ui dropdown icon item" style="visibility: none !important; visibility: hidden !important;">
            <i class="wrench icon" style="display: none;"></i>
            <div class="menu">
                <div v-for="item in items" :key="item.name" class="item">
                    {{item.name}}
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: ['items'],
    computed: {
    },
    methods: {
        show(x, y) {
            $(this.$el)
                .css('left', x - 17).css('top', y - 55);
            $(this.$refs.drop)
                .dropdown('show');
        },
        hide() {
            $(this.$refs.drop).dropdown('hide');
        }
    },
    mounted() {
        $(this.$refs.drop).dropdown();
    },
}
</script>

<style>

</style>
