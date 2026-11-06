const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const load = (name, extra = {}) => vm.runInNewContext(fs.readFileSync(`js/${name}.js`, 'utf8').replace(/^import .*;\r?\n/gm, '').replace(`export default class ${name}`, `class ${name}`) + `\n${name};`, { Phaser: { Scene: class {} }, ...extra });
const Level2Scene = load('Level2Scene');
const Level4Scene = load('Level4Scene', { Level2Scene });
const sprite = (x, y) => ({ x, y, width: 12, height: 16, active: true,
    destroy() { this.active = false; }, setFrame() { return this; }, setFlipX() { return this; },
    setOrigin() { return this; }, setPosition() { return this; }, once() {}, play() {} });
for (const name of ['hammer-upper', 'hammer-lower']) {
    const scene = new Level4Scene();
    const pickup = sprite(100, 100);
    scene.objects = new Map([[name, pickup]]);
    scene.mario = { x: 106, y: 110, flipX: false, frame: { name: 15 }, play() {} };
    scene.marioPhysics = { isJumping: false };
    scene.add = { sprite }; scene.level = { add() {} };
    let expire;
    scene.time = { delayedCall: (delay, fn) => { assert.equal(delay, 8000); expire = fn; return { remove() {} }; } };
    scene.pickUpHammer();
    assert(!scene.heldHammer, 'Pickup requires jumping');
    scene.marioPhysics.isJumping = true;
    scene.pickUpHammer();
    assert(scene.heldHammer && !pickup.active && !scene.objects.has(name));
    const near = sprite(121, 110), far = sprite(180, 110);
    scene.fireHunters = { hunters: [{ sprite: near }, { sprite: far }] };
    scene.updateHammer();
    assert(!near.active && far.active);
    assert.equal(scene.fireHunters.hunters.length, 1);
    const held = scene.heldHammer;
    expire();
    assert(!held.active && scene.heldHammer === null);
}
console.log('PASS: both level 4 hammer pickups, flame smashing and expiry');
