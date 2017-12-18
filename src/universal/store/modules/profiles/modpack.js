export default {
    state: () => ({
        type: 'modpack',
        editable: true,
        author: '',
        description: '',
        url: '',
        icon: '',
    }),
    actions: {
        serialize(context, payload) {
            return JSON.stringify(context.state, (key, value) => {
                if (key === 'settings' || key === 'maps') return undefined;
                return value;
            })
        },
        refresh(context, payload) { },
    },
}
