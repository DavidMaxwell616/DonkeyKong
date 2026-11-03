// Numbered frames in the four-column, 48 x 36 spritesheet (row-major order).
// Row 0: idle, laughing, and chest beating. Row 1: throws (frame 7 is an effect).
// Row 2: climbing. Row 3: climbing with Pauline. Row 4: defeat.
export default function createKongAnimations(anims) {
    const animations = [
        { key: 'kong-idle', frames: [0, 1], frameRate: 2, repeat: -1 },
        { key: 'kong-laugh', frames: [0, 1], frameRate: 6, repeat: -1 },
        {
            key: 'kong-chest-beat',
            frames: [0, 2, 0, 3],
            frameRate: 6, repeat: -1
        },
        {
            key: 'kong-drop', frames: [0, 4, 5, 0],
            frameRate: 6, repeat: 0
        },
        {
            key: 'kong-throw-right', frames: [0, 5, 6, 5, 0],
            frameRate: 6, repeat: 0
        },
        {
            key: 'kong-climb', frames: [8, 9, 10, 11],
            frameRate: 6, repeat: -1
        },
        {
            key: 'kong-climb-pauline', frames: [12, 13, 14, 15],
            frameRate: 6, repeat: -1
        },
        {
            key: 'kong-defeat', frames: [16, 17, 18, 19],
            frameRate: 5, repeat: 0
        }
    ];

    for (const { key, frames, frameRate, repeat } of animations) {
        // Phaser's animation manager survives scene restarts.
        if (!anims.exists(key)) {
            anims.create({
                key,
                frames: frames.map(frame => ({ key: 'kong', frame })),
                frameRate,
                repeat
            });
        }
    }
}
