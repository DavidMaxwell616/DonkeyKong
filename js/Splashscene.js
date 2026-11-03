import createKongAnimations from './KongAnimations.js';
import { getStartingScene } from './DebugConfig.js';

export default class SplashScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SplashScene' });
    }

    preload() {
        this.load.image('title-screen', 'assets/images/title-screen.png');
        this.load.image('insert-coin', 'assets/images/16412090-donkey-kong-arcade-insert-coin.png');
        this.load.spritesheet('kong', 'assets/images/kong.png', {
            frameWidth: 48,
            frameHeight: 36
        });
    }

    create() {
        const { width, height } = this.scale;
        const screen = this.add.image(width / 2, height / 2, 'title-screen');
        const fitScreen = () => {
            screen.setScale(Math.min(width / screen.width, height / screen.height));
        };
        fitScreen();
        createKongAnimations(this.anims);
        const kong = this.add.sprite(width / 2, height * 0.7, 'kong', 0)
            .setScale(screen.scaleX)
            .play('kong-chest-beat');

        let started = false;
        const startGame = () => {
            if (started) return;
            started = true;
            this.scene.start(getStartingScene());
        };

        const timer = this.time.delayedCall(3000, () => {
            kong.destroy();
            screen.setTexture('insert-coin');
            fitScreen();
            this.input.keyboard.on('keydown', startGame);
            this.input.on('pointerdown', startGame);
        });

        this.events.once('shutdown', () => {
            timer.remove();
            this.input.keyboard.off('keydown', startGame);
            this.input.off('pointerdown', startGame);
        });
    }
}
