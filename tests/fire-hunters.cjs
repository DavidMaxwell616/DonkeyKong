const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const FireHunters = vm.runInNewContext(fs.readFileSync('js/FireHunters.js', 'utf8')
    .replace('export default class FireHunters', 'class FireHunters') + '\nFireHunters;');
const level = { tileSize: 8, platforms: [
    { x: 0, y: 40, tiles: 20 }, { x: 0, y: 80, tiles: 20 }
] };
let ladderOpen = true;
const sprite = () => ({ active: true, x: 0, y: 0,
    setOrigin() { return this; }, play() { return this; }, setFlipX() {},
    setPosition(x, y) { this.x = x; this.y = y; return this; } });
const scene = {
    mario: { x: 100, y: 80 },
    marioPhysics: { grounded: true, ladders: [
        { x: 20, platform: 0, lowerPlatform: 1, isClimbable: () => ladderOpen }
    ] },
    anims: { exists: () => true }, time: { delayedCall() {} },
    oilBarrel: { x: 0, y: 80, width: 10 }, add: { sprite }, level: { add() {} },
    tweens: { addCounter() {} }
};
const hunters = new FireHunters(scene, { level, heightAt: (x, p) => p.y, patrolRow: 0 });
hunters.spawn(); hunters.spawn();
const [guard, ordinary] = hunters.hunters;
for (const h of hunters.hunters) { h.hopping = false; h.sprite.setPosition(40, 80); }
assert(guard.patrol && !ordinary.patrol, 'Only the first hunter patrols');
hunters.update(100);
assert(guard.sprite.x < 40 && ordinary.sprite.x > 40, 'Guard seeks ladder while ordinary hunter pursues Mario');
ladderOpen = false;
const pausedX = guard.sprite.x;
hunters.update(100);
assert.notEqual(guard.sprite.x, pausedX, 'Guard paces while folding ladder is closed');
assert(guard.sprite.y < 80, 'Pacing includes a small hop');
ladderOpen = true;
for (let i = 0; i < 100; i++) hunters.update(100);
assert.equal(guard.row, 0, 'Guard reaches upper platform');
let reversed = false;
let previousX = guard.sprite.x;
for (let i = 0; i < 150; i++) {
    hunters.update(100);
    assert.equal(guard.row, 0);
    assert(guard.sprite.x >= 5 && guard.sprite.x <= 155);
    if (guard.sprite.x < previousX) reversed = true;
    previousX = guard.sprite.x;
}
assert(reversed, 'Guard reverses at platform edge');
scene.mario.y = 40;
scene.marioPhysics.grounded = false;
hunters.update(100);
assert(!hunters.patrolReleased, 'Passing near platform does not release guard');
scene.marioPhysics.grounded = true;
hunters.update(100);
assert(hunters.patrolReleased, 'Landing releases guard');
scene.mario.y = 80;
for (let i = 0; i < 150; i++) hunters.update(100);
assert.equal(guard.row, 1, 'Guard follows Mario off platform after activation');
const normal = new FireHunters(scene, { level, heightAt: (x, p) => p.y });
normal.spawn();
assert(!normal.hunters[0].patrol, 'Other levels retain ordinary hunters');
console.log('PASS: hunter ascent, folding ladder wait, patrol bounds/reversal, arrival trigger and persistent pursuit');
// A missing rivet splits a floor even when Mario is on the same row.
const gapHunters = new FireHunters(scene, { level, heightAt: (x, p) => p.y, autoSpawn: false,
    boundsAt: (row, x) => row === 0 ? (x < 60 ? { left: 5, right: 51 } : { left: 69, right: 155 })
        : { left: 5, right: 155 } });
gapHunters.ladders = [];
gapHunters.spawnAt(0, 40);
gapHunters.hunters[0].sprite.setPosition(40, 40);
scene.mario.x = 100; scene.mario.y = 40;
for (let i = 0; i < 200; i++) {
    gapHunters.update(50);
    assert(gapHunters.hunters[0].sprite.x <= 51, 'Pacing never crosses a removed rivet');
}
gapHunters.ladders = [{ x: 90, platform: 0, lowerPlatform: 1 }];
assert.equal(gapHunters.nextLadder(0, 1, 40, 100), null, 'Cannot reach ladder across gap');
gapHunters.ladders.push({ x: 20, platform: 0, lowerPlatform: 1 });
assert.equal(gapHunters.nextLadder(0, 0, 40, 100).ladder.x, 20,
    'Can pursue via intact ladders around the gap');
console.log('PASS: rivet gaps block pacing and direct routes, intact detours remain usable');
