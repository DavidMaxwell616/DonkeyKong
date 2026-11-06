const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const planck = require('../js/vendor/planck.min.js');
const MarioPhysics = vm.runInNewContext(read('js/MarioPhysics.js')
    .replace('export default class MarioPhysics', 'class MarioPhysics') + '\nMarioPhysics;', { planck });
const layout = JSON.parse(read('assets/levels/level-3.json'));
const rows = layout.platforms.map(row => Array.from({ length: row.tiles }, (_, i) => ({ x: row.x + i * 8, y: row.y })));
const physics = new MarioPhysics(rows, 8, 12, 232, layout.ladders);
for (let i = 0; i < 60; i++) physics.update(1000 / 60, 0);
assert(physics.grounded, 'Mario starts on a solid platform');
assert(physics.ladders.some(ladder => ladder.platform === 0 && ladder.lowerPlatform === 1),
    'The upper ladder reaches Pauline');
for (const row of rows) for (const tile of row) {
    assert(tile.x >= 0 && tile.x + 8 <= layout.width && tile.y + 8 <= layout.height);
}
const Intermission = vm.runInNewContext(read('js/IntermissionScene.js')
    .replace('export default class IntermissionScene', 'class IntermissionScene') + '\nIntermissionScene;',
    { Phaser: { Scene: class {} } });
for (const height of [25, 50, 75, 100]) {
    const scene = new Intermission();
    const calls = [];
    const frames = [];
    const drawable = () => ({ width: 224, height: 256, setOrigin() { return this; },
        add() {}, setScale() {}, setPosition() {} });
    scene.cameras = { main: { setBackgroundColor() {} } };
    scene.add = { container: drawable, image: drawable, rectangle: drawable };
    scene.textures = { get: () => ({ has: () => false, add: name => frames.push(name) }) };
    scene.scale = { width: 800, height: 500, on() {}, off() {} };
    scene.events = { once() {} };
    scene.time = { delayedCall: (delay, fn) => { assert.equal(delay, 3000); scene.advance = fn; } };
    scene.scene = Object.fromEntries(['start', 'stop', 'wake'].map(name => [name, (...args) => calls.push([name, ...args])]));
    const hudValues = { score: 2300, lives: 2, highScore: 5000 };
    scene.create(height >= 75 ? { height, nextScene: `Level${height / 25}Scene`, previousScene: `Level${height / 25 - 1}Scene`, hudValues }
        : { height, hudValues });
    scene.advance();
    if (height === 25) assert.equal(calls[0][0], 'wake');
    else {
        assert.equal(calls[0][1], height === 50 ? 'GameScene' : `Level${height / 25 - 1}Scene`);
        assert.equal(calls[1][1], `Level${height / 25}Scene`);
        assert.equal(calls[1][2].hudValues, hudValues);
    }
    assert.equal(frames.filter(name => name === 'tier').length, height / 25 - 1);
}

const level4 = JSON.parse(read('assets/levels/level-4.json'));
const floors4 = level4.platforms.map(row => Array.from({ length: row.tiles }, (_, i) => ({
    x: row.x + i * 8, y: row.y
})));
const physics4 = new MarioPhysics(floors4, 8, 48, 248, level4.ladders);
for (let i = 0; i < 60; i++) physics4.update(1000 / 60, 0);
assert(physics4.grounded, 'Level 4 spawn is grounded');
for (let row = 1; row < 5; row++) {
    assert(physics4.ladders.some(ladder => ladder.platform === row && ladder.lowerPlatform === row + 1),
        `Rivet floor ${row} is reachable by ladder`);
}
const Level4 = vm.runInNewContext(read('js/Level4Scene.js').replace(/^import .*;\r?\n/gm, '')
    .replace('export default class Level4Scene', 'class Level4Scene') + '\nLevel4Scene;',
    { Phaser: { Scene: class {} } });
const rivetScene = new Level4();
rivetScene.marioPhysics = physics4;
rivetScene.rivets = level4.rivets.map(rivet => {
    let floorBody;
    for (let body = physics4.world.getBodyList(); body; body = body.getNext()) {
        const p = body.getPosition();
        if (p.x * 16 === rivet.x + 4 && p.y * 16 === rivet.y + 4) floorBody = body;
    }
    assert(floorBody, 'Each rivet has a removable floor body');
    return { ...rivet, body: floorBody, image: { destroy() {} }, tile: { destroy() {} } };
});
rivetScene.hud = { values: { score: 200, highScore: 1000, bonus: 5000 },
    setValues(values) { Object.assign(this.values, values); } };
rivetScene.mario = { play() {} };
rivetScene.pauline = { anims: { stop() {} }, setFrame() {} };
rivetScene.kong = { anims: { stop() {} } };
rivetScene.startVictorySequence = () => { rivetScene.victoryStarted = true; };
const initialBodies = physics4.world.getBodyCount();
for (const rivet of rivetScene.rivets) {
    physics4.body.setPosition(planck.Vec2((rivet.x + 4) / 16, (rivet.y - 8) / 16));
    physics4.body.setLinearVelocity(planck.Vec2(0, 0));
    physics4.previousFeetY = rivet.y;
    for (let i = 0; i < 5; i++) physics4.update(1000 / 60, 0);
    assert(physics4.grounded);
    rivetScene.mario.x = rivet.x + 4;
    rivetScene.mario.y = rivet.y;
    rivetScene.updateRivets();
    assert(rivet.removed);
}
assert.equal(physics4.world.getBodyCount(), initialBodies - 8);
assert(rivetScene.finished);
assert(rivetScene.victoryStarted);
assert.equal(rivetScene.hud.values.score, 6000);
assert.equal(rivetScene.hud.values.highScore, 6000);
assert.equal(rivetScene.hud.values.bonus, 0);
console.log('PASS: 25/50/75/100 m transitions, HUD carryover, spawn physics, level 4 ladders and all eight rivets');

