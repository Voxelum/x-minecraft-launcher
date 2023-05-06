const core = require('@actions/core');

async function main(output) {
   output('build_number', process.env.GITHUB_RUN_NUMBER);
}

main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
