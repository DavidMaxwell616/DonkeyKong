const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/Level3Scene.js', 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace('export default class Level3Scene', 'class Level3Scene') + '\nLevel3Scene;';
const Scene = vm.runInNewContext(source, { Phaser: { Scene: class {} }, GODMODE: false });
const scene = new Scene();
scene.pauline = { anims: { stop() {} }, setFrame() {} };
scene.springPlatform = { x: 0, y: 88, tiles: 21 };
scene.springBottom = 274;
scene.springs = [];
scene.fireHunters = { hunters: [] };
scene.springSpawnDelay = 100000;
scene.add = { sprite: (x, y, texture, frame) => ({ x, y, frame, active: true,
    setOrigin() { return this; }, setFrame(frame) { this.frame = frame; return this; },
    anims: { pause() {} }, destroy() { this.active = false; } }) };
scene.level = { add() {} };
scene.spawnSpring();
const spring = scene.springs[0];
assert.equal(spring.sprite.x, 10);
assert.equal(spring.sprite.y, 60, 'Spring enters at the hop apex');
assert.equal(spring.sprite.frame, 3, 'Entry uses the airborne frame');
const hopDistance = (spring.endX - spring.startX) / 3;
assert.equal(spring.dropX - spring.endX, hopDistance, 'Exit hop matches every preceding hop');
assert.equal(spring.sprite.x - spring.startX, hopDistance / 2, 'Entry starts halfway through the first hop');
scene.updateSprings(10);
assert(spring.sprite.y > 60 && spring.sprite.y < 61, 'Spring descends smoothly from its apex');
assert(spring.sprite.x > 10 && spring.sprite.x < 12, 'Entry continues smoothly to the right');
let contacts = 0;
let previousFrame = 3;
for (let i = 0; i < 220; i++) {
    scene.updateSprings(10);
    if (spring.sprite.frame === 4) {
        assert.equal(spring.sprite.y, 88, 'Compressed frame stays on platform');
        if (previousFrame !== 4) contacts++;
    } else {
        assert.equal(spring.sprite.frame, 3, 'Flight uses extended frame');
    }
    previousFrame = spring.sprite.frame;
}
assert.equal(contacts, 3, 'Each of three bounces displays the compressed frame');
assert(spring.sprite.y < 88, 'Exit hop is still above platform height');
// Advance to the bottom of the exit hop (2.84 seconds into the sequence).
spring.elapsed = 2.83;
scene.updateSprings(10);
assert(Math.abs(spring.sprite.y - 88) < 1e-8, 'Vertical drop begins at the bottom of the hop');
assert(Math.abs(spring.sprite.x - 178) < 1e-8, 'Exit hop clears the platform');
for (let i = 0; i < 10; i++) {
    scene.updateSprings(50);
    assert.equal(spring.sprite.x, 178, 'Fall stays vertical beyond the platform');
    assert(spring.sprite.x - 9 > 168, 'Entire sprite clears the platform edge');
    assert.equal(spring.sprite.frame, 3, 'Drop uses airborne frame');
    assert(spring.sprite.y > 88);
}
scene.mario = { x: 178, y: spring.sprite.y, once() {}, play() {}, anims: { resume() {} } };
scene.hud = { values: { lives: 3 }, setValues(v) { Object.assign(this.values, v); } };
assert(scene.checkEnemyCollision());
assert.equal(scene.hud.values.lives, 2);
assert(!scene.checkEnemyCollision(), 'Collision cannot deduct a second life');
for (let i = 0; i < 30; i++) scene.updateSprings(50);
assert.equal(scene.springs.length, 0);
assert(!spring.sprite.active);
scene.springSpawnDelay = 0;
scene.updateSprings(50);
assert.equal(scene.springs.length, 1, 'Springs respawn');
console.log('PASS: three spring bounces, vertical drop, cleanup, respawn and collision');

