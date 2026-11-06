import createKongAnimations from './KongAnimations.js';
import { getStartingScene } from './DebugConfig.js';
import { beginScoreRun, getHighScores } from './HighScores.js';

export default class SplashScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SplashScene' });
    }

    preload() {
        this.load.image('title-screen', 'assets/images/title-screen.png');
        this.load.image('kongfont', 'assets/images/kongfont.png');
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
            beginScoreRun();
            this.scene.start(getStartingScene());
        };

        const timer = this.time.delayedCall(3000, () => {
            kong.destroy();
            screen.setVisible(false);
            this.showInsertCoin();
            this.input.keyboard.on('keydown', startGame);
            this.input.on('pointerdown', startGame);
        });

        this.events.once('shutdown', () => {
            timer.remove();
            this.input.keyboard.off('keydown', startGame);
            this.input.off('pointerdown', startGame);
        });
    }

    showInsertCoin() {
        const panel = this.add.container(0, 0);
        const font = this.textures.get('kongfont');
        const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let index = 0; index < characters.length; index++) {
            const char = characters[index];
            if (!font.has(char)) font.add(char, 0, (index % 10) * 8, Math.floor(index / 10) * 8, 8, 7);
        }
        const write = (text, x, y, color) => {
            [...text].forEach((char, index) => {
                if (char === ' ') return;
                panel.add(this.add.image(x + index * 8, y, 'kongfont', char).setOrigin(0).setTint(color));
            });
        };
        const scores = getHighScores();
        const number = score => String(Math.min(999999, score)).padStart(6, '0');
        const red = 0xff0000, cyan = 0x00ffff, yellow = 0xffff00;
        write('1UP', 24, 0, red);
        write('HIGH SCORE', 72, 0, red);
        write(number(scores[0]?.score ?? 0), 88, 8, 0xffffff);
        write('000000', 8, 8, 0xffffff);
        write('INSERT COIN', 64, 56, cyan);
        write('PLAYER    COIN', 56, 80, cyan);
        write('1        1', 72, 96, cyan);
        write('2        2', 72, 112, red);
        write('RANK  SCORE      NAME', 8, 144, cyan);
        ['1ST', '2ND', '3RD', '4TH', '5TH'].forEach((rank, index) => {
            const color = index < 3 ? red : yellow;
            write(rank, 8, 160 + index * 16, color);
            write(number(scores[index]?.score ?? 0), 48, 160 + index * 16, color);
            write(scores[index]?.name ?? '', 144, 160 + index * 16, color);
        });
        write('1981 NINTENDO', 56, 240, cyan);
        const fit = () => {
            const { width, height } = this.scale;
            const scale = Math.min(width / 224, height / 256);
            panel.setScale(scale).setPosition((width - 224 * scale) / 2, (height - 256 * scale) / 2);
        };
        fit();
        this.scale.on('resize', fit);
        this.events.once('shutdown', () => this.scale.off('resize', fit));
    }
}
