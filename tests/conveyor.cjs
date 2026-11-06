const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const planck = require('../js/vendor/planck.min.js');
const Physics = vm.runInNewContext(fs.readFileSync('js/MarioPhysics.js', 'utf8').replace('export default class MarioPhysics', 'class MarioPhysics') + '\nMarioPhysics;', { planck });
const rows = [Array.from({ length: 26 }, (_, i) => ({ x: 8 + i * 8, y: 208 }))];
for (const speed of [-24, 24]) {
    const p = new Physics(rows, 8, 112, 208, [], () => speed, [], { mergeFlatPlatforms: true });
    p.update(1000 / 60, 0);
    let pos;
    for (let i = 0; i < 120; i++) {
        pos = p.update(1000 / 60, 0);
        assert(p.grounded, 'No airborne flicker at tile seams');
        assert(Math.abs(pos.y - 208) < 0.2, 'Mario rides at a stable height');
    }
    assert(Math.abs(pos.x - (112 + speed * 2)) < 0.01, 'Belt carries Mario at constant speed');
    p.update(1000 / 60, 0, false, false, true);
    assert(p.isJumping && !p.grounded, 'Mario can still jump off the belt');
}
console.log('PASS: smooth conveyor travel both directions, stable grounding and jumping');
