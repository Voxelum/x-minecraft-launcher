<template>
    <div class="ui container">
        <div v-html="description"></div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            description: '',
            loading: false,
            files: [],
        }
    },
    created() {
        this.refresh();
    },
    methods: {
        refresh() {
            const self = this;
            self.loading = true;
            this.$store.dispatch('query',
                { service: 'curseforge', action: 'project', payload: `/projects/${this.id}` })
                .then(proj => {
                    self.description = proj.description;
                    self.files = proj.files
                    self.loading = false;
                })
        },
    },
    props: ['id'],
}
</script>

<style>

</style>
