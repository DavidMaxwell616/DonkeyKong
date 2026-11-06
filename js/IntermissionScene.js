export default class IntermissionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IntermissionScene' });
    }

    preload() {
        this.load.image('how-high', 'assets/images/how-high.png');
        this.load.image('scorefont', 'assets/images/kongfont.png');
    }

    create(data = {}) {
        this.cameras.main.setBackgroundColor('#000000');
        const screen = this.add.container(0, 0);
        // Named tier frames persist between visits; always select the full image.
        const background = this.add.image(0, 0, 'how-high', '__BASE').setOrigin(0);
        screen.add(background);
        const targetHeight = data.height ?? 25;
        for (let tierHeight = 50; tierHeight <= targetHeight; tierHeight += 25) {
            const reference = this.textures.get('how-high');
            if (!reference.has('tier')) reference.add('tier', 0, 40, 200, 96, 32);
            const tierY = 200 - (tierHeight / 25 - 1) * 40;
            screen.add(this.add.image(40, tierY, 'how-high', 'tier').setOrigin(0));
            screen.add(this.add.rectangle(40, tierY + 24, 24, 8, 0x000000).setOrigin(0));
            const font = this.textures.get('scorefont');
            for (const [index, digit] of [...String(tierHeight)].entries()) {
                const frame = `intermission-${digit}`;
                if (!font.has(frame)) font.add(frame, 0, digit * 8, 0, 8, 7);
                screen.add(this.add.image(40 + index * 8, tierY + 24, 'scorefont', frame).setOrigin(0));
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

        const nextScene = data.nextScene ?? (data.height === 50 ? 'Level2Scene' : null);
        const timer = data.resumeGame === false && !nextScene ? null : this.time.delayedCall(3000, () => {
            if (nextScene) {
                this.scene.stop(data.previousScene ?? 'GameScene');
                this.scene.start(nextScene, { hudValues: data.hudValues });
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
