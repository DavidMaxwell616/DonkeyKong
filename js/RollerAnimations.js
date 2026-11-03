// Four 11 x 10 frames per end cap; ascending frames turn clockwise.
export default function createRollerAnimations(anims) {
    for (const [side, frames] of [['left', [0, 1, 2, 3]], ['right', [4, 5, 6, 7]]]) {
        for (const direction of ['clockwise', 'counter-clockwise']) {
            const key = `roller-${side}-${direction}`;
            if (anims.exists(key)) continue;
            anims.create({
                key,
                frames: (direction === 'clockwise' ? frames : [...frames].reverse())
                    .map(frame => ({ key: 'rollers', frame })),
                frameRate: 5,
                repeat: -1
            });
        }
    }
}
