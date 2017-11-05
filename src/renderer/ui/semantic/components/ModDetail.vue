<template>
    <div class="ui items">
        <div class="item">
            <a class="ui small image">
                <img>
            </a>
            <div class="content">
                <a class="header"><b><font size='14'>Mod Tittle</font></b></a>
                <div class="description">
                    <p>{{mod.modid}}</p>
                    <p>{{mod.name}}</p>
                    <p>{{mod.authors}}</p>
                    <p>{{mod.description}}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data: () => ({
        mod: {
            modid: 'lucaisgenius',
            name: 'luca',
            authors: [
                "a", "b"
            ]
            ,
            description: "hahahah is sooooo fun",
            version: "0.00.0.0.0.0",
            mcversion: "0.0.0..00",
        }
    })
};
</script>

<style>

</style>
