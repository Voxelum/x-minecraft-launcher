<template>
    <div id="profileModal" class="ui basic error modal" :class="{error: hasError}" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="archive icon"></i>
            Create A New Profile
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>Name</label>
                <input class="ui basic inverted input" type="text" placeholder="Name of profile">
            </div>
            <div class="field">
                <label>Author</label>
                <input class="ui basic inverted input" type="text" placeholder="author" value="ci010">
            </div>
            <div class="field">
                <label>Description</label>
                <input class="ui basic inverted input" type="text" placeholder="Enter the simple description">
            </div>
            <div class="ui error message">
                <div class="header">Action Forbidden</div>
                <p>You can only sign up for an account once with a given e-mail address.</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>No</div>
            <div class="ui green basic inverted ok button">
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
                    self.author = defaultAuthor || ""
                    self.description = 'No description yet'
                    self.hasError = false
                },
                onApprove($element) {
                    if (!self.name || self.name === '') {
                        self.hasError = true;
                        return false;
                    }
                    self.$emit('accept', { name: self.name, author: self.author, description: self.description });
                    return true;
                },
                onDeny($element) {
                },
            }
        )
    },
    methods: {
        show() {
            $('#profileModal').modal('show')
        },
    }
}
</script>

<style>

</style>
