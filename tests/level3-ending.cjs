const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const layout = JSON.parse(fs.readFileSync('assets/levels/level-3.json', 'utf8'));
const Scene = vm.runInNewContext(fs.readFileSync('js/Level3Scene.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default class Level3Scene', 'class Level3Scene') + '\nLevel3Scene;', { Phaser: { Scene: class {} }, planck: { Vec2: () => ({ x: 0, y: 0 }) } });
const sprite = (x, y) => ({ x, y, visible: true, anims: { stop() {} },
    setFrame(v) { this.frame = v; return this; }, setFlipX() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setVisible(v) { this.visible = v; return this; }, play(v) { this.animation = v; return this; },
    setMask() {}, clearMask() {} });
const scene = new Scene();
scene.mario = sprite(128, 56); scene.pauline = sprite(96, 56); scene.kong = sprite(44, 88); scene.heart = sprite(0, 0);
scene.marioPhysics = { body: { setLinearVelocity() {} } };
let removed = 0;
scene.springs = [{ sprite: { destroy() { removed++; } } }];
scene.fireHunters = { destroy() { removed++; } };
scene.hud = { values: { score: 300, highScore: 500, bonus: 4000 }, setValues(v) { Object.assign(this.values, v); } };
scene.cache = { json: { get: () => layout } };
scene.level = { x: 0, y: 0, scaleX: 2, scaleY: 2, bringToTop() {} };
const timers = [];
scene.time = { delayedCall: (delay, fn) => timers.push(fn) };
scene.tweens = { add: config => { scene.escape = config; } };
scene.scale = { on() {}, off() {} }; scene.events = { once() {}, off() {} };
scene.make = { graphics: () => ({ clear() { return this; }, fillStyle() { return this; }, fillRect() {}, createGeometryMask: () => ({ destroy() {} }), destroy() {} }) };
scene.scene = { launch: (key, data) => { scene.transition = data; }, sleep() {} };
scene.startEnding();
assert(scene.finished && scene.heart.visible);
assert.equal(removed, 2);
assert.equal(scene.hud.values.score, 4300);
scene.startEnding();
assert.equal(timers.length, 1, 'Ending starts only once');
timers.shift()();
assert.equal(scene.kong.animation, 'kong-climb');
assert.equal(scene.kong.x, 76);
scene.kong.y = 68;
scene.escape.onUpdate();
assert(!scene.pauline.visible);
assert.equal(scene.kong.animation, 'kong-climb-pauline');
scene.escape.onComplete();
assert(!scene.kong.visible);
assert.equal(scene.heart.frame, 'broken-heart');
timers.shift()();
assert.equal(scene.transition.nextScene, 'Level4Scene');
assert.equal(scene.transition.height, 100);
assert.equal(scene.transition.hudValues.score, 4300);
console.log('PASS: level 3 reunion, kidnapping, broken heart and level 4 transition');
