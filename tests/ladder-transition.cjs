const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const planck = require('../js/vendor/planck.min.js');
const Physics = vm.runInNewContext(fs.readFileSync('js/MarioPhysics.js', 'utf8')
    .replace('export default class MarioPhysics', 'class MarioPhysics') + '\nMarioPhysics;', { planck });
const rows = [40, 80].map(y => Array.from({ length: 10 }, (_, i) => ({ x: i * 8, y })));
const physics = new Physics(rows, 8, 20, 80, [{ x: 16, segments: [[48, 32]] }]);
for (let i = 0; i < 30; i++) physics.update(1000 / 60, 0);
const up = [];
for (let i = 0; i < 100; i++) {
    physics.update(1000 / 60, 0, true);
    const frame = physics.ladderTransitionFrame;
    if (frame !== null && up.at(-1) !== frame) up.push(frame);
}
assert.deepEqual(up, [7, 8, 9, 10]);
const down = [];
for (let i = 0; i < 100; i++) {
    physics.update(1000 / 60, 0, false, true);
    const frame = physics.ladderTransitionFrame;
    if (frame !== null && down.at(-1) !== frame) down.push(frame);
    if (frame === 9) {
        physics.update(1000 / 60, 0);
        assert.equal(physics.ladderTransitionFrame, 9, 'Stopping holds the transition pose');
    }
}
assert.deepEqual(down, [10, 9, 8, 7]);
assert.equal(physics.ladderTransitionFrame, null, 'Normal pose resumes off the ladder');
console.log('PASS: ascent 7–10, descent 10–7, paused pose and exit');
