const sounds = ['walk', 'thump', 'springcoin', 'prefall', 'point', 'jump', 'hammerhit', 'grunt', 'fall', 'die'];

export function preloadAudio(scene) {
    for (const name of sounds) {
        if (!scene.cache.audio.exists(name)) scene.load.audio(name, `assets/sounds/${name}.wav`);
    }
}

export default class GameAudio {
    constructor(scene) {
        this.scene = scene;
        this.active = new Set();
        this.stepDelay = 0;
        scene.events.on('postupdate', this.update, this);
        scene.events.on('sleep', this.stop, this);
        scene.events.on('pause', this.stop, this);
        scene.events.once('shutdown', () => {
            this.stop();
            scene.events.off('postupdate', this.update, this);
            scene.events.off('sleep', this.stop, this);
            scene.events.off('pause', this.stop, this);
        });
    }

    play(name) {
        const scene = this.scene;
        if (scene.sound.locked || !scene.cache.audio.exists(name)) return;
        // A cue already playing should not pile up with itself.
        if ([...this.active].some(sound => sound.key === name)) return;
        const sound = scene.sound.add(name);
        this.active.add(sound);
        sound.once('complete', () => {
            this.active.delete(sound);
            sound.destroy();
        });
        sound.play();
    }

    stop() {
        for (const sound of this.active) sound.destroy();
        this.active.clear();
    }

    update(time, delta) {
        const scene = this.scene;
        const physics = scene.marioPhysics;
        const jumping = Boolean(physics?.isJumping);
        if (jumping && !this.jumping) this.play('jump');
        this.jumping = jumping;
        const moving = physics && !scene.marioDying && !scene.marioMovementLocked && !scene.finished &&
            ((physics.grounded && (scene.cursors?.left.isDown || scene.cursors?.right.isDown)) || physics.climbMoving);
        this.stepDelay -= delta;
        if (moving && this.stepDelay <= 0) {
            this.play('walk');
            this.stepDelay = 160;
        }
        if (!moving) this.stepDelay = 0;
    }
}
