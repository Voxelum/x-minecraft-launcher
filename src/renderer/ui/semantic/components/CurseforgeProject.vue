<template>
    <div id="project-container" class="ui grid" style="">
        <div v-if="loading" class="ui active inverted dimmer">
            <div class="ui text loader">Loading</div>
        </div>
        <div class="four wide column">
            <div class="ui card">
                <div class=" image">
                    <img :src="image">
                </div>
                <div class="content">
                    <div class="header">
                        {{name}}
                    </div>
                    <div class="meta">
                        <i class="download icon"></i>
                        {{totalDownload}}
                    </div>
                    <div class="meta">
                        <i class="time icon"></i>
                        {{date(createdDate)}}
                    </div>
                    <div class="meta">
                        <i class="upload icon"></i>
                        {{date(lastFile)}}
                    </div>
                </div>
                <div class="extra content">
                    <div class="ui vertical fluid secondary menu">
                        <a class="active item" data-tab="description">
                            Description
                        </a>
                        <a class="item" data-tab="files">
                            Files
                        </a>
                        <a class="item" data-tab="license">
                            License
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <div class="twelve wide column" style="overflow-x:hidden; max-height:500px;">
            <div class="ui active tab" data-tab="description">
                <div v-html="description"></div>
            </div>
            <div class="ui tab" data-tab="files">
                <div class="ui middle aligned selection black list">
                    <div v-for="f of files" :key="f.href" class="item" style="padding-left:20px">
                        <div class="ui ribbon label">
                            {{f.type}}
                        </div>
                        <div class="content">
                            <div class="header">{{f.name}}</div>
                            <div class="extra">
                                {{date(f.date)}}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="ui tab" data-tab="license">

            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            description: '',
            loading: false,
            files: [],
            createdDate: '',
            lastFile: '',
            totalDownload: '',
            license: '',
            name: '',
            image: '',
        }
    },
    created() {
        this.refresh();
    },
    methods: {
        date(string) {
            const date = new Date(0)
            date.setUTCSeconds(Number.parseInt(string))
            return date.toLocaleDateString()
        },
        refresh() {
            const self = this;
            self.loading = true;
            this.$store.dispatch('query',
                { service: 'curseforge', action: 'project', payload: `/projects/${this.id}` })
                .then(proj => {
                    self.createdDate = proj.createdDate;
                    self.lastFile = proj.lastFile;
                    self.totalDownload = proj.totalDownload;
                    self.license = proj.license;
                    self.image = proj.image;
                    self.name = proj.name;
                    self.description = proj.description;
                    self.files = proj.files
                    self.loading = false;
                    this.$nextTick(() => {
                        $('.menu .item').tab({
                        })
                    })
                })
        },
    },
    props: ['id'],
}
</script>

<style>

</style>
