const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const planck = require('../js/vendor/planck.min.js');
const readClass = (file, name, globals = {}) => vm.runInNewContext(fs.readFileSync(file, 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(`export default class ${name}`, `class ${name}`) + `\n${name};`, globals);
const FireHunters = readClass('js/FireHunters.js', 'FireHunters');
const Physics = readClass('js/MarioPhysics.js', 'MarioPhysics', { planck });
const Scene = readClass('js/Level3Scene.js', 'Level3Scene', { Phaser: { Scene: class {} }, GODMODE: false });
const level = JSON.parse(fs.readFileSync('assets/levels/level-3.json', 'utf8'));
const scene = new Scene();
scene.pauline = { anims: { stop() {} }, setFrame() {} };
const tiles = level.platforms.map(p => Array.from({ length: p.tiles }, (_, i) => ({ x: p.x + i * 8, y: p.y })));
scene.marioPhysics = new Physics(tiles, 8, 12, 232, level.ladders);
scene.mario = { x: 12, y: 232, once() {}, play() {}, anims: { resume() {} } };
scene.anims = { exists: () => true };
scene.time = { delayedCall() { assert.fail('No timed spawning on level 3'); } };
scene.add = { sprite: (x, y) => ({ x, y, active: true, setOrigin() { return this; },
    play() { return this; }, setFlipX() {}, anims: { pause() {} }, destroy() { this.active = false; } }) };
scene.level = { add() {} };
scene.fireHunters = new FireHunters(scene, { level, heightAt: (x, p) => p.y, autoSpawn: false });
for (const { row, x } of level.hunterSpawns) scene.fireHunters.spawnAt(row, x);
const hunters = scene.fireHunters.hunters;
assert.equal(hunters.length, 2);
assert.equal(hunters[0].sprite.x, 72);
assert.equal(hunters[0].sprite.y, 136);
assert.equal(hunters[1].sprite.x, 216);
assert.equal(hunters[1].sprite.y, 104);
assert(hunters.every(h => !h.hopping));
scene.fireHunters.update(50);
assert(hunters[0].sprite.x > 72, 'Hunter paces when Mario is unreachable');
assert(hunters[0].sprite.y < 136, 'Pacing hunter hops above its platform');
let reversed = false;
let previousX = hunters[0].sprite.x;
for (let i = 0; i < 100; i++) {
    scene.fireHunters.update(50);
    for (const hunter of hunters) {
        const platform = level.platforms[hunter.row];
        assert(hunter.sprite.x >= platform.x + 5);
        assert(hunter.sprite.x <= platform.x + platform.tiles * 8 - 5);
        assert(hunter.sprite.y >= platform.y - 4 && hunter.sprite.y <= platform.y);
    }
    if (hunters[0].sprite.x < previousX) reversed = true;
    previousX = hunters[0].sprite.x;
}
assert(reversed, 'Unreachable hunter reverses at platform edges');
scene.mario.x = 62;
scene.mario.y = 136;
hunters[0].sprite.x = 75;
scene.fireHunters.update(50);
assert(hunters[0].sprite.x < 75, 'Hunter resumes pursuit when Mario is reachable');
assert.equal(hunters[0].sprite.y, 136, 'Pursuit clears the pacing hop');
scene.springs = [];
scene.hud = { values: { lives: 3 }, setValues(v) { Object.assign(this.values, v); } };
scene.mario.x = hunters[0].sprite.x;
scene.mario.y = hunters[0].sprite.y;
assert(scene.checkEnemyCollision());
assert.equal(scene.hud.values.lives, 2);
scene.fireHunters.destroy();
assert.equal(scene.fireHunters.hunters.length, 0);
console.log('PASS: level 3 starting hunter positions, pursuit, collision and cleanup');
