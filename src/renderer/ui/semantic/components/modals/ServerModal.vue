<template>
    <div class="ui basic modal" :class="{error: hasError}" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="server icon"></i>
            {{ isEdit ? $t('server.edit') :$t('server.create')}}
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>{{$t('name')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="Name Of server" v-model="name" @keypress="enter">
            </div>
            <div class="field">
                <label>{{$t('server.host')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="IP address" v-model="ip" @keypress="enter">
            </div>
            <div class="field">
                <label>{{$t('server.port')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="25565" v-model="port" @keypress="enter">
            </div>
            <div class="ui error message">
                <div class="header">Action Forbidden</div>
                <p>IP address is required! Please enter it!</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>{{$t('no')}}</div>
            <div class="ui green basic inverted button" @click="accept">
                <i class="check icon"></i>
                {{ isEdit ? $t('save') : $t('create')}}
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            name: '',
            ip: '',
            port: 25565,
            hasError: false,
            isEdit: false,
        }
    },
    mounted() {
        const self = this
        $(this.$el).modal({ blurring: true, })
    },
    methods: {
        show(args) {
            if (args && args.isEdit) {
                this.isEdit = true
                this.ip = args.host;
                this.port = args.port;
                this.name = args.name;
            } else {
                this.isEdit = false
                this.hasError = true
                this.ip = ''
                this.name = ''
                this.port = 25565
            }
            this.$nextTick(() => {
                $(this.$el).modal('show')
            })
        },
        accept() {
            if (!this.ip || this.ip === '') {
                this.hasError = true
                return;
            }
            if (!this.port || this.port === '') this.port = '25565'
            this.$nextTick(() => {
                $(this.$el).modal('hide')
            })
            this.$emit('accept', { name: this.name, host: this.ip, port: this.port, isEdit: this.isEdit })
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
