// Five columns of 18 x 18 frames, numbered from left to right.
export default function createMarioAnimations(anims) {
    const animations = [
        { key: 'mario-idle', frames: [0], frameRate: 1, repeat: -1 },
        { key: 'mario-run', frames: [1, 2], frameRate: 10, repeat: -1 },
        { key: 'mario-jump', frames: [3], frameRate: 1, repeat: -1 },
        { key: 'mario-stop', frames: [4], frameRate: 1, repeat: 0 },
        { key: 'mario-climb', frames: [5, 6], frameRate: 6, repeat: -1 },
        { key: 'mario-reaches-top-of-ladder', frames: [7, 8, 9, 10, 11], frameRate: 10, repeat: 0 },
        { key: 'mario-hammer', frames: [12, 13, 14, 15, 16, 17], frameRate: 10, repeat: -1 },
        { key: 'mario-dies', frames: [18, 19, 20, 21, 22], frameRate: 6, repeat: 0 }
    ];

    for (const { key, frames, frameRate, repeat } of animations) {
        if (!anims.exists(key)) {
            anims.create({
                key,
                frames: frames.map(frame => ({ key: 'mario', frame })),
                frameRate,
                repeat
            });
        }
    }
}
