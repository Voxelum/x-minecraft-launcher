<template>
    <div id="project-container" class="ui container" style="overflow-x:hidden; max-height:100%">
        <div v-if="loading" class="ui active inverted dimmer">
            <div class="ui text loader">Loading</div>
        </div>
        <div class="ui dividing rail" style="">
            <div id="project-detail" class="ui sticky middle aligned selection list" style="height:300px !important; width:200px !important; overflow-x:hidden; left:500px">
                <div v-for="f of files" :key="f.href" class="item">
                    <div class="content">
                        <div class="header">{{f.name}}</div>
                        <div class="extra">
                            <div class="ui label">{{f.date}}</div>
                            <div class="ui label">{{f.size}}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
        $('#project-detail').sticky({
            context: '#project-container'
        })
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
