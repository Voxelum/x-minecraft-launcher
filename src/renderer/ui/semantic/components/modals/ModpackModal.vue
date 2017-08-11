<template>
    <div class="ui basic error modal" :class="{error: hasError}" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="archive icon"></i>
            {{ isEdit?$t('modpack.edit'):$t('modpack.create')}}
        </div>
        <form class="ui inverted form">
            <div class="field">
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
                <div class="header">Action Forbidden</div>
                <p>You can only sign up for an account once with a given e-mail address.</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>{{$t('no')}}</div>
            <div class="ui green basic inverted ok button" @click="accept">
                <i class="check icon"></i>
                {{ isEdit?$t('save'):$t('create')}}
            </div>
    
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            name: '',
            author: '',
            description: '',
            hasError: false,
            isEdit: false,
        }
    },
    props: ['defaultAuthor'],
    mounted() {
        const self = this
        $(this.$el).modal({ blurring: true })
    },
    methods: {
        show(args) {
            if (args && args.isEdit) {
                this.isEdit = true;
                this.name = args.name;
                this.description = args.description;
                this.author = args.author;
            }
            else {
                this.isEdit = false
                this.name = ''
                this.author = this.defaultAuthor || ""
                this.description = 'No description yet'
                this.hasError = false
            }
            $(this.$el).modal('show')
        },
        accept() {
            if (!this.name || this.name === '') {
                this.hasError = true;
            }
            this.$emit('accept', { name: this.name, author: this.author, description: this.description, isEdit: this.isEdit });
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
