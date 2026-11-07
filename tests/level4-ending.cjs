const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const layout = JSON.parse(fs.readFileSync('assets/levels/level-4.json', 'utf8'));
const Scene = vm.runInNewContext(fs.readFileSync('js/Level4Scene.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default class Level4Scene', 'class Level4Scene') + '\nLevel4Scene;', { Phaser: { Scene: class {} }, planck: { Vec2: () => ({}) } });
const drawable = (x = 0, y = 0) => ({ x, y, active: true, anims: { stop() {} },
    destroy() { this.active = false; }, setPosition(x, y) { this.x = x; this.y = y; return this; },
    setVisible(v) { this.visible = v; return this; }, setFlipX(v) { this.flipX = v; return this; },
    setTint(v) { this.tint = v; return this; },
    setScale(v) { this.displayHeight = this.height * v; return this; },
    play(v) { this.animation = v; return this; }, setFrame(v) { this.frame = v; return this; }, setOrigin() { return this; } });
const scene = new Scene();
scene.cache = { json: { get: () => layout } };
scene.marioPhysics = { body: { setLinearVelocity() {} } };
scene.mario = drawable(); scene.pauline = drawable(112, 48); scene.kong = drawable(112, 88);
scene.mario.height = 18;
scene.pauline.displayHeight = 23;
scene.upperHammer = drawable(); scene.supports = [drawable(), drawable()];
scene.platforms = layout.platforms.map(p => Array.from({ length: p.tiles }, (_, i) => drawable(p.x + i * 8, p.y)));
scene.ladderTiles = [];
scene.level = { add() {}, bringToTop() {} };
const timers = [], tweens = [];
scene.time = { delayedCall: (delay, callback) => timers.push(callback) };
scene.tweens = { add: tween => tweens.push(tween) };
scene.textures = { get: () => ({ has: () => true }) };
let splash;
const glyphs = [];
scene.add = { rectangle: drawable, image: (x, y, key, frame) => {
    if (key === 'scorefont') glyphs.push({ y, frame });
    return drawable(x, y);
} };
scene.scene = { start: key => { splash = key; } };
scene.clearHammer = () => {};
scene.startVictorySequence();
assert.equal(scene.mario.visible, true, 'Mario stays visible during the collapse');
for (let i = 0; i < 4; i++) {
    timers.shift()();
    assert.equal(tweens.length, 1, 'Only one floor falls at a time');
    const tween = tweens.shift();
    assert.equal(tween.targets.length, 12);
    assert(tween.targets.every(tile => tile.x >= 64 && tile.x < 160 && tile.y === 208 - i * 40));
    assert.equal(tween.y, 240 - i * 8);
    tween.targets.forEach(tile => { tile.y = tween.y; });
    tween.onComplete();
}
timers.shift()();
assert.equal(scene.kong.frame, 16, 'Kong uses the upside-down falling pose');
assert.notEqual(scene.kong.animation, 'kong-defeat');
const fall = tweens.shift();
assert.equal(fall.targets, scene.kong);
assert.equal(fall.y, 216);
fall.onComplete();
assert.equal(scene.kong.animation, 'kong-defeat');
timers.shift()();
assert(scene.mario.visible);
assert.equal(scene.mario.y, scene.pauline.y);
assert.equal(scene.mario.displayHeight, scene.pauline.displayHeight);
assert(scene.pauline.x < scene.mario.x);
assert.equal(scene.mario.flipX, true);
assert.equal(scene.pauline.flipX, false);
assert.equal(glyphs.filter(g => g.y === 108).map(g => g.frame.slice(8)).join(''), 'YOUWON');
assert.equal(glyphs.filter(g => g.y === 124).map(g => g.frame.slice(8)).join(''), 'GAMEOVER');
timers.shift()();
assert.equal(splash, 'SplashScene');
console.log('PASS: sequential floor collapse, heap, Kong defeat, reunion, victory text and splash');
