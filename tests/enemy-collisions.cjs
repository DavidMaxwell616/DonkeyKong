const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const [name, types, method] of [
    ['GameScene', ['barrel', 'flame'], 'checkEnemyCollision'],
    ['Level2Scene', ['pie', 'flame'], 'checkEnemyCollision'],
    ['Level3Scene', ['spring', 'flame'], 'checkEnemyCollision'],
    ['Level4Scene', ['flame'], 'checkFlameCollision']
]) {
    const Scene = vm.runInNewContext(fs.readFileSync(`js/${name}.js`, 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(`export default class ${name}`, `class ${name}`) + `\n${name};`,
        { Phaser: { Scene: class {} }, GODMODE: false, planck: { Vec2: () => ({}) } });
    for (const type of types) {
        const scene = new Scene();
        const enemy = { active: true, x: 100, y: 100, width: 18, height: 8, anims: { pause() {} } };
        scene.mario = { x: 100, y: 100, once() {}, play() {}, anims: { resume() {} } };
        scene.lives = 3;
        scene.hud = { values: { lives: 3 }, setValues(v) { Object.assign(this.values, v); } };
        scene.barrels = new Set(type === 'barrel' ? [enemy] : []);
        scene.pies = type === 'pie' ? [enemy] : [];
        scene.springs = type === 'spring' ? [{ sprite: enemy }] : [];
        scene.fireHunters = { hunters: type === 'flame' ? [{ sprite: enemy }] : [] };
        scene.rollers = [];
        scene.marioPhysics = { body: { setLinearVelocity() {} } };
        scene.time = { removeAllEvents() {} };
        scene.tweens = { pauseAll() {} };
        scene.paulineHelp = { setVisible() {} };
        scene.clearHammer = () => {};
        scene.stopPaulineYell = () => {};
        enemy.active = false;
        assert(!scene[method](), `${name}: inactive ${type} ignored`);
        enemy.active = true;
        scene.mario.x = 150;
        assert(!scene[method](), `${name}: separated ${type} ignored`);
        scene.mario.x = 100;
        assert(scene[method](), `${name}: ${type} collision detected`);
        assert.equal(scene.hud.values.lives, 2);
        assert(!scene[method](), `${name}: no duplicate life loss`);
    }
}
console.log('PASS: every moving enemy type across all four levels, inactive enemies and single life loss');
