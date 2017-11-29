<template>
    <div>

    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    data: () => ({
        loading: true,
        data: null,
    }),
    props: ['id'],
    methods: {
        ...vuex.mapActions('mcmod.cn', ['detail'])
    },
    mounted() {
        if (this.data === null) {
            if (!this.id) throw new Error('Unexpected missing page id!')
            this.loading = true;
            this.detail(this.id).then(data => { this.data = data; this.loading = false });
        }
    },
}
</script>

<style>

</style>
