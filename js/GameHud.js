import { recordScore, getHighScores } from './HighScores.js';

export default class GameHud {
    constructor(scene, parent) {
        this.scene = scene;
        this.container = scene.add.container(0, 0);
        parent.add(this.container);
        parent.sendToBack(this.container);
        this.values = { score: 0, highScore: 0, lives: 3, level: 1, bonus: 0 };

        const font = scene.textures.get('scorefont');
        for (const color of ['white', 'blue', 'cyan']) {
            for (let digit = 0; digit < 10; digit++) {
                const name = `${color}-${digit}`;
                if (!font.has(name)) font.add(name, 0, digit * 8, 0, 8, 7);
            }
        }
        const reference = scene.textures.get('level-1-props');
        for (const [name, x, y, w, h] of [
            ['high-score-label', 72, 0, 80, 8],
            ['level-label', 168, 24, 16, 8],
            ['bonus-box', 168, 40, 48, 20]
        ]) {
            if (!reference.has(name)) reference.add(name, 0, x, y, w, h);
        }
        this.setValues({});
    }

    setValues(values) {
        Object.assign(this.values, values);
        recordScore(this.values.score);
        this.values.highScore = Math.max(this.values.highScore, getHighScores()[0]?.score ?? 0);
        this.container.removeAll(true);
        const add = (x, y, texture, frame) => {
            this.container.add(this.scene.add.image(x, y, texture, frame).setOrigin(0));
        };
        const digits = (value, count, x, y, color) => {
            const text = String(Math.max(0, Math.floor(value))).padStart(count, '0').slice(-count);
            [...text].forEach((digit, i) => add(x + i * 8, y, 'scorefont', `${color}-${digit}`));
        };

        add(72, 0, 'level-1-props', 'high-score-label');
        digits(this.values.score, 6, 8, 8, 'white');
        digits(this.values.highScore, 6, 88, 8, 'white');
        // The active Mario counts as one life; icons show the remaining spares.
        for (let i = 0; i < this.values.lives - 1; i++) add(8 + i * 8, 24, 'life-icon');
        add(168, 24, 'level-1-props', 'level-label');
        digits(this.values.level, 2, 184, 24, 'blue');
        add(168, 40, 'level-1-props', 'bonus-box');
        this.container.add(this.scene.add.rectangle(176, 48, 32, 8, 0x000000).setOrigin(0));
        digits(this.values.bonus, 4, 176, 48, 'cyan');
    }
}
