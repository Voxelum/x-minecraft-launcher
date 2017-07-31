<template>
    <div id="profileModal" class="ui basic error modal" :class="{error: hasError}" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="archive icon"></i>
            Create A New Profile
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>Name</label>
                <input class="ui basic inverted input" type="text" placeholder="Profile Name" v-model="name" @keypress="enter">
            </div>
            <div class="field">
                <label>Author</label>
                <input class="ui basic inverted input" type="text" placeholder="Author Name" v-model="author" @keypress="enter">
            </div>
            <div class="field">
                <label>Description</label>
                <input class="ui basic inverted input" type="text" placeholder="A Simple description" v-model="description" @keypress="enter">
            </div>
            <div class="ui error message">
                <div class="header">Action Forbidden</div>
                <p>You can only sign up for an account once with a given e-mail address.</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>No</div>
            <div class="ui green basic inverted ok button" @click="accpet">
                <i class="check icon"></i>Create</div>
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
        }
    },
    props: ['defaultAuthor'],
    mounted() {
        const self = this
        $('#profileModal').modal(
            {
                blurring: true,
                onShow() {
                    self.name = ''
                    self.author = this.defaultAuthor || ""
                    self.description = 'No description yet'
                    self.hasError = false
                },
            }
        )
    },
    methods: {
        show() {
            $('#profileModal').modal('show')
        },
        accpet() {
            if (!this.name || this.name === '') {
                this.hasError = true;
            }
            this.$emit('accept', { name: this.name, author: this.author, description: this.description });
            $('#profileModal').modal('hide')
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
