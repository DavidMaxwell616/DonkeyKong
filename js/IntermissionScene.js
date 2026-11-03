export default class IntermissionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IntermissionScene' });
    }

    preload() {
        this.load.image('how-high', 'assets/images/how-high.png');
        this.load.image('scorefont', 'assets/images/scorefont.png');
    }

    create(data = {}) {
        this.cameras.main.setBackgroundColor('#000000');
        const screen = this.add.container(0, 0);
        const background = this.add.image(0, 0, 'how-high').setOrigin(0);
        screen.add(background);
        if (data.height === 50) {
            const reference = this.textures.get('how-high');
            if (!reference.has('tier')) reference.add('tier', 0, 40, 200, 96, 32);
            screen.add(this.add.image(40, 160, 'how-high', 'tier').setOrigin(0));
            screen.add(this.add.rectangle(40, 184, 16, 8, 0x000000).setOrigin(0));
            const font = this.textures.get('scorefont');
            for (const [index, digit] of [5, 0].entries()) {
                const frame = `intermission-${digit}`;
                if (!font.has(frame)) font.add(frame, 0, digit * 8, 0, 8, 7);
                screen.add(this.add.image(40 + index * 8, 184, 'scorefont', frame).setOrigin(0));
            }
        }
        const fitScreen = () => {
            const { width, height } = this.scale;
            const scale = Math.min(width / background.width, height / background.height);
            screen.setScale(scale);
            screen.setPosition((width - background.width * scale) / 2,
                (height - background.height * scale) / 2);
        };
        fitScreen();
        this.scale.on('resize', fitScreen);

        const timer = data.resumeGame === false && data.height !== 50 ? null : this.time.delayedCall(3000, () => {
            if (data.height === 50) {
                this.scene.stop('GameScene');
                this.scene.start('Level2Scene', { hudValues: data.hudValues });
                return;
            }
            this.scene.wake('GameScene');
            this.scene.stop();
        });
        this.events.once('shutdown', () => {
            timer?.remove();
            this.scale.off('resize', fitScreen);
        });
    }
}
