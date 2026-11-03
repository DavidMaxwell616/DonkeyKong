export default function createPaulineAnimations(anims) {
    if (!anims.exists('pauline-yelling')) {
        anims.create({
            key: 'pauline-yelling',
            frames: [0, 1].map(frame => ({ key: 'pauline', frame })),
            frameRate: 6,
            // Initial cycle plus two repeats gives three cycles.
            repeat: 2
        });
    }
}
