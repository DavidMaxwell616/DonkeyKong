// Thirteen 18 x 18 frames: wooden rolling frames 0–3, steel rolling frames 7–10.
export default function createBarrelAnimations(anims) {
    const animations = [
        { key: 'barrel-roll-right', frames: [0, 1, 2, 3] },
        { key: 'barrel-roll-left', frames: [3, 2, 1, 0] },
        { key: 'barrel-roll-sideways', frames: [4, 5] },
        { key: 'steel-barrel-roll-right', frames: [7, 8, 9, 10] },
        { key: 'steel-barrel-roll-left', frames: [10, 9, 8, 7] },
        { key: 'steel-barrel-roll-sideways', frames: [11, 12] },
    ];

    for (const { key, frames } of animations) {
        if (!anims.exists(key)) {
            anims.create({
                key,
                frames: frames.map(frame => ({ key: 'barrels', frame })),
                frameRate: 10,
                repeat: -1
            });
        }
    }
}
