<template>
    <div class="ui basic error modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="archive icon"></i>
            {{ isEdit?$t('modpack.edit'):$t('modpack.create')}}
        </div>
        <form class="ui inverted form" :class="{error: nameError}">
            <div class="field" :class="{error:nameError}">
                <label>{{$t('name')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="Profile Name" v-model="name" @keypress="enter">
            </div>
            <div class="field">
                <label>{{$t('author')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="Author Name" v-model="author" @keypress="enter">
            </div>
            <div class="field">
                <label>{{$t('description')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="A Simple description" v-model="description" @keypress="enter">
            </div>
            <div class="ui error message">
                <div class="header">{{$t('actionforbidden')}}</div>
                <p>{{$t('modpack.error.requirename')}}</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>{{$t('no')}}</div>
            <div class="ui green basic inverted button" @click="accept">
                <i class="check icon"></i>
                {{ isEdit?$t('save'):$t('create')}}
            </div>
        </div>
    </div>
</template>

<script>

import vuex from 'vuex'

export default {
    data: () => ({
        name: '',
        author: '',
        description: '',
        isEdit: false,

        nameError: false,
    }),
    mounted() {
        const self = this;
        $(this.$el).modal({
            blurring: true,
            onHidden() {
                self.nameError = false;
            }
        })
    },
    computed: {
        ...vuex.mapGetters('auth', {
            defaultAuthor: 'username'
        }),
        profile() {
            return this.$store.getters['profiles/selected']
        }
    },
    methods: {
        show(args = {}) {
            const { isEdit } = args;
            this.isEdit = isEdit || false;
            if (this.isEdit) {
                this.name = this.profile.name;
                this.description = this.profile.description;
                this.author = this.profile.author;
            }
            else {
                this.name = ''
                this.author = this.defaultAuthor || ""
                this.description = 'No description yet'
            }
            $(this.$el).modal('show')
        },
        accept() {
            console.log(this.name)
            if (!this.name || this.name === '') {
                this.nameError = true;
                return
            }
            if (this.isEdit) {
                this.$store.commit(`profiles/${this.profileId}/putAll`, {
                    name: this.name,
                    author: this.author,
                    description: this.description,
                })
            } else {
                this.$store.dispatch(`profiles/create`, {
                    type: 'modpack',
                    option: {
                        name: this.name,
                        author: this.author,
                        description: this.description,
                    },
                })
            }
            $(this.$el).modal('hide')
        },
        enter(event) {
            if (event.keyCode != 13) return
            this.accept()
        }
    }
}
</script>

<style>

</style>
