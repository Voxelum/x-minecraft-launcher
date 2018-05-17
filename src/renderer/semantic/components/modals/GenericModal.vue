<template>
    <div class="ui small basic modal transition hidden">
        <div class="ui icon header">
            <i :class="iconClass"></i>
            {{header}}
        </div>
        <div class="content">
            {{content}}
        </div>
        <div class="actions">
            <div :class="denyButtonClass" class="basic inverted cancel button">
                <i :class="denyIconClass"></i>{{deny || $t('no')}}</div>
            <div :class="acceptButtonClass" class="basic inverted ok button">
                <i :class="acceptIconClass"></i>{{accept || $t('yes')}}</div>
        </div>
    </div>
</template>

<script>
export default {
    data: () => ({
        icon: '',
        acceptIcon: '',
        accept: '',
        deny: '',
        denyIcon: '',
        header: '',
        content: '',
        acceptColor: '',
        denyColor: '',

    }),
    mounted() {
        const self = this
        $(this.$el).modal({
            blurring: true,
        })
    },
    computed: {
        acceptButtonClass() {
            return {
                ui: true,
                [this.acceptColor || 'green']: true,
            }
        },
        denyButtonClass() {
            return {
                ui: true,
                [this.denyColor]: true,
            }
        },
        iconClass() {
            return {
                [this.icon || 'question']: true,
                icon: true,
            }
        },
        denyIconClass() {
            return {
                [this.denyIcon || 'close']: true,
                icon: true,
            }
        },
        acceptIconClass() {
            return {
                [this.acceptIcon || 'check']: true,
                icon: true,
            }
        },
    },
    methods: {
        show({ header, icon, content, acceptIcon, denyIcon, accept, deny, acceptColor, denyColor, onAccept }) {
            this.header = header;
            this.content = content;
            this.icon = icon || '';
            this.acceptIcon = acceptIcon;
            this.denyIcon = denyIcon;
            this.accept = accept;
            this.deny = deny;
            this.acceptColor = acceptColor;
            this.denyColor = denyColor;
            $(this.$el)
                .modal({
                    blurring: true,
                    onApprove($element) {
                        onAccept()
                        return true;
                    },
                })
                .modal('show');
        }
    },
}
</script>

<style>

</style>
