const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const name of ['Level3Scene', 'Level4Scene']) {
    const Scene = vm.runInNewContext(fs.readFileSync(`js/${name}.js`, 'utf8').replace(/^import .*;\r?\n/gm, '')
        .replace(`export default class ${name}`, `class ${name}`) + `\n${name};`, { Phaser: { Scene: class {} } });
    const scene = new Scene();
    assert.doesNotThrow(() => scene.stopPaulineYell());
    let stopped = false, hidden = false, removed = false;
    scene.paulineYellTimer = { remove() { removed = true; } };
    scene.pauline = { active: true, removeAllListeners() {}, anims: { stop() { stopped = true; } }, setFrame() {} };
    scene.paulineHelp = { active: true, setVisible(v) { hidden = !v; } };
    scene.stopPaulineYell();
    assert(stopped && hidden && removed);
    scene.pauline.active = false;
    delete scene.pauline.anims;
    scene.pauline.setFrame = () => assert.fail('Destroyed sprite must not be updated');
    scene.paulineHelp.active = false;
    scene.paulineHelp.setVisible = () => assert.fail('Destroyed HELP must not be updated');
    assert.doesNotThrow(() => scene.stopPaulineYell());
    assert.doesNotThrow(() => scene.stopPaulineYell());
}
console.log('PASS: Pauline cleanup before creation, while active, after destruction and repeated shutdown');
