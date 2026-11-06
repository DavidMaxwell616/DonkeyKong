import Level2Scene from './Level2Scene.js';
import GameHud from './GameHud.js';
import MarioPhysics from './MarioPhysics.js';
import FireHunters from './FireHunters.js';
import { GODMODE } from './DebugConfig.js';
import createMarioAnimations from './MarioAnimations.js';
import createKongAnimations from './KongAnimations.js';
import createPaulineAnimations from './PaulineAnimations.js';

export default class Level4Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'Level4Scene' });
    }

    preload() {
        Level2Scene.prototype.preload.call(this);
        this.load.json('level-4', 'assets/levels/level-4.json');
    }

    create(data = {}) {
        const layout = this.cache.json.get('level-4');
        this.finished = false;
        this.objects = new Map();
        const scoreTexture = this.textures.get('pickup-scores');
        if (!scoreTexture.has('300')) scoreTexture.add('300', 0, 48, 0, 24, 8);
        this.marioDying = false;
        this.heldHammer = null;
        this.hammerTimer = null;
        if (!this.anims.exists('barrel-destroy')) {
            this.anims.create({ key: 'barrel-destroy',
                frames: this.anims.generateFrameNumbers('hammer', { start: 4, end: 7 }),
                frameRate: 10, repeat: 0 });
        }
        this.flameElapsed = 0;
        this.flameSpawnDelay = 6000;
        this.cameras.main.setBackgroundColor('#000000');
        createMarioAnimations(this.anims);
        createKongAnimations(this.anims);
        createPaulineAnimations(this.anims);
        this.level = this.add.container(0, 0);
        const tile = (x, y, frame) => {
            const image = this.add.image(x, y, 'game-tiles', frame).setOrigin(0);
            this.level.add(image);
            return image;
        };
        this.platforms = layout.platforms.map(row => Array.from({ length: row.tiles },
            (_, column) => tile(row.x + column * 8, row.y, 'girder-blue')));
        this.ladderTiles = [];
        for (const ladder of layout.ladders) {
            for (const [y, height] of ladder.segments) {
                for (let offset = 0; offset < height; offset += 8) {
                    this.ladderTiles.push(tile(ladder.x, y + offset, 'ladder-yellow'));
                }
            }
        }
        const props = this.textures.get('level-2-pie');
        for (const [name, x, y, width, height] of [
            ['umbrella', 181, 2, 16, 15], ['hat', 145, 8, 16, 9],
            ['purse', 166, 8, 9, 9], ['rivet', 203, 9, 8, 9]
        ]) {
            if (!props.has(name)) props.add(name, 0, x, y, width, height);
        }
        const addProp = (name, x, y) => {
            const image = this.add.image(x, y, 'level-2-pie', name).setOrigin(0);
            this.level.add(image);
            return image;
        };
        this.supports = [64, 152].flatMap(x =>
            [56, 64, 72, 80].map(y => tile(x, y, 'ladder-blue')));
        this.objects.set('umbrella', addProp('umbrella', 28, 73));
        this.objects.set('hat', addProp('hat', 124, 239));
        this.objects.set('purse', addProp('purse', 203.5, 199));
        const hammerTexture = this.textures.get('hammer');
        if (!hammerTexture.has('pickup')) hammerTexture.add('pickup', 0, 5, 8, 9, 10);
        const addHammer = (x, y) => {
            const hammer = this.add.image(x, y, 'hammer', 'pickup').setOrigin(0);
            this.level.add(hammer);
            return hammer;
        };
        this.upperHammer = addHammer(105.5, 104);
        this.objects.set('hammer-upper', this.upperHammer);
        this.objects.set('hammer-lower', addHammer(9.5, 144));
        this.rivets = layout.rivets.map(({ x, y }) => ({
            x, y, image: addProp('rivet', x, y - 1), removed: false,
            tile: this.platforms.flat().find(tile => tile.x === x && tile.y === y)
        }));
        this.kong = this.add.sprite(112, 88, 'kong', 0).setOrigin(0.5, 1).play('kong-chest-beat');
        this.pauline = this.add.sprite(112, 48, 'pauline', 0).setOrigin(0.5, 1);
        this.mario = this.add.sprite(48, 248, 'mario', 0).setOrigin(0.5, 1);
        this.level.add([this.kong, this.pauline, this.mario]);
        this.paulineHelp = this.add.sprite(this.pauline.x + 10,
            this.pauline.y - 16, 'help', 0).setOrigin(0, 1).setVisible(false);
        this.level.add(this.paulineHelp);
        this.schedulePaulineYell();
        this.marioPhysics = new MarioPhysics(this.platforms, 8, 48, 248, layout.ladders);
        this.fireHunters = new FireHunters(this, {
            level: layout, heightAt: (x, platform) => platform.y, autoSpawn: false,
            boundsAt: (row, x) => this.flameBounds(layout.platforms[row], x, layout.tileSize)
        });
        // Retain each rivet's floor body so removal opens a real, jumpable gap.
        for (let body = this.marioPhysics.world.getBodyList(); body; body = body.getNext()) {
            const position = body.getPosition();
            const rivet = this.rivets.find(rivet => position.x * 16 === rivet.x + 4 &&
                position.y * 16 === rivet.y + 4);
            if (rivet) rivet.body = body;
        }
        this.cursors = this.input.keyboard.createCursorKeys();
        this.hud = new GameHud(this, this.level);
        this.hud.setValues({ ...data.hudValues, level: 4, bonus: 5000 });
        const fit = () => {
            const { width, height } = this.scale;
            const scale = Math.min(width / layout.width, height / layout.height);
            this.level.setScale(scale).setPosition((width - layout.width * scale) / 2,
                (height - layout.height * scale) / 2);
        };
        fit();
        this.scale.on('resize', fit);
        this.events.once('shutdown', () => {
            this.stopPaulineYell();
            this.clearHammer();
            this.scale.off('resize', fit);
            this.marioPhysics = null;
            this.rivets = [];
            this.fireHunters.destroy();
        });
    }

    schedulePaulineYell() {
        Level2Scene.prototype.schedulePaulineYell.call(this);
    }

    stopPaulineYell() {
        this.paulineYellTimer?.remove();
        this.paulineYellTimer = null;
        this.pauline?.removeAllListeners?.('animationcomplete-pauline-yelling');
        if (this.pauline?.active) {
            this.pauline.anims?.stop();
            this.pauline.setFrame(0);
        }
        if (this.paulineHelp?.active) this.paulineHelp.setVisible(false);
    }

    clearHammer() {
        Level2Scene.prototype.clearHammer.call(this);
    }

    pickUpHammer() {
        Level2Scene.prototype.pickUpHammer.call(this);
    }

    updateHammer() {
        Level2Scene.prototype.updateHammer.call(this);
    }

    flameBounds(platform, x, tileSize) {
        let left = platform.x + 5;
        let right = platform.x + platform.tiles * tileSize - 5;
        for (const rivet of this.rivets) {
            if (!rivet.removed || rivet.y !== platform.y) continue;
            // If a gap opens underneath a flame, keep it on the nearest side.
            if (x < rivet.x + tileSize / 2) right = Math.min(right, rivet.x - 5);
            else left = Math.max(left, rivet.x + tileSize + 5);
        }
        return { left, right };
    }

    updateFlames(delta) {
        if (this.finished || this.marioDying) return;
        const elapsed = Math.min(delta, 50);
        this.flameElapsed += elapsed;
        this.flameSpawnDelay -= elapsed;
        if (this.flameSpawnDelay <= 0) {
            const layout = this.fireHunters.level;
            const row = Phaser.Math.Between(1, layout.platforms.length - 1);
            const platform = layout.platforms[row];
            const fromLeft = Phaser.Math.Between(0, 1) === 0;
            const x = fromLeft ? platform.x + 5 : platform.x + platform.tiles * layout.tileSize - 5;
            this.fireHunters.spawnAt(row, x);
            this.flameSpawnDelay = Math.max(1500, 6000 - this.flameElapsed * 0.05);
        }
        this.fireHunters.update(elapsed);
    }

    checkFlameCollision() {
        if (GODMODE || this.finished || this.marioDying) return false;
        const hit = this.fireHunters.hunters.some(({ sprite }) => sprite.active &&
            Math.abs(this.mario.x - sprite.x) < 11 &&
            this.mario.y > sprite.y - 14 && this.mario.y - 16 < sprite.y);
        if (!hit) return false;
        this.marioDying = true;
        this.stopPaulineYell();
        this.clearHammer();
        const lives = Math.max(0, this.hud.values.lives - 1);
        this.hud.setValues({ lives });
        for (const { sprite } of this.fireHunters.hunters) sprite.anims.pause();
        this.mario.once('animationcomplete-mario-dies', () => {
            if (lives > 0) this.scene.restart({ hudValues: { ...this.hud.values } });
            else this.scene.start('SplashScene');
        });
        this.mario.play('mario-dies');
        this.mario.anims.resume();
        return true;
    }

    updateRivets() {
        if (this.finished || !this.marioPhysics.grounded) return;
        for (const rivet of this.rivets) {
            if (rivet.removed || Math.abs(this.mario.x - rivet.x - 4) > 4 ||
                Math.abs(this.mario.y - rivet.y) > 2) continue;
            rivet.removed = true;
            rivet.image.destroy();
            rivet.tile.destroy();
            this.marioPhysics.world.destroyBody(rivet.body);
            const score = this.hud.values.score + 100;
            this.hud.setValues({ score, highScore: Math.max(score, this.hud.values.highScore) });
        }
        if (!this.rivets.every(rivet => rivet.removed)) return;
        this.finished = true;
        this.stopPaulineYell();
        this.fireHunters?.destroy();
        this.mario.play('mario-idle');
        this.kong.anims.stop();
        const score = this.hud.values.score + this.hud.values.bonus;
        this.hud.setValues({ score, highScore: Math.max(score, this.hud.values.highScore), bonus: 0 });
        this.startVictorySequence();
    }

    startVictorySequence() {
        this.clearHammer();
        const layout = this.cache.json.get('level-4');
        const tileSize = layout.tileSize;
        this.marioPhysics.body.setLinearVelocity(planck.Vec2(0, 0));
        this.mario.setVisible(true);
        this.upperHammer.destroy();
        this.supports.forEach(support => support.destroy());
        const floors = [...new Set(layout.rivets.map(rivet => rivet.y))].sort((a, b) => b - a);
        let heapTop = Math.max(...layout.platforms.map(platform => platform.y));
        const dropFloor = index => {
            if (index === floors.length) {
                this.kong.anims.stop();
                this.kong.setFrame(16);
                this.level.bringToTop(this.kong);
                this.tweens.add({ targets: this.kong, y: heapTop, duration: 1200,
                    ease: 'Quad.easeIn', onComplete: () => {
                        this.kong.play('kong-defeat');
                        this.time.delayedCall(600, () => this.showVictoryReunion());
                    } });
                return;
            }
            const y = floors[index];
            const rivets = layout.rivets.filter(rivet => rivet.y === y);
            const left = Math.min(...rivets.map(rivet => rivet.x)) + tileSize;
            const right = Math.max(...rivets.map(rivet => rivet.x));
            const section = this.platforms.flat().filter(tile => tile.active &&
                tile.y === y && tile.x >= left && tile.x < right);
            for (const ladder of this.ladderTiles) {
                if (ladder.active && ladder.x >= left && ladder.x < right &&
                    ladder.y >= y && ladder.y < y + 40) ladder.destroy();
            }
            heapTop -= tileSize;
            this.tweens.add({ targets: section, y: heapTop, duration: 550,
                ease: 'Quad.easeIn', onComplete: () => {
                    this.time.delayedCall(180, () => dropFloor(index + 1));
                } });
        };
        this.time.delayedCall(400, () => dropFloor(0));
    }

    showVictoryReunion() {
        this.pauline.anims.stop();
        this.pauline.setFrame(0).setFlipX(true);
        this.mario.setPosition(this.pauline.x - 24, this.pauline.y)
            .setVisible(true).setFlipX(false).play('mario-idle');
        this.mario.setScale(this.pauline.displayHeight / this.mario.height);
        const texture = this.textures.get('pauline');
        if (!texture.has('heart')) texture.add('heart', 0, 110, 9, 15, 13);
        this.level.add(this.add.image((this.mario.x + this.pauline.x) / 2,
            this.pauline.y - this.pauline.displayHeight - 6, 'pauline', 'heart'));
        this.level.add(this.add.text(112, 112, 'YOU WON! GAME OVER', {
            fontFamily: 'monospace', fontSize: '10px', color: '#ffffff',
            backgroundColor: '#000000', padding: { x: 4, y: 4 }
        }).setOrigin(0.5));
        this.time.delayedCall(4000, () => this.scene.start('SplashScene'));
    }

    update(time, delta) {
        if (this.finished || this.marioDying || !this.marioPhysics) return;
        Level2Scene.prototype.updateMario.call(this, Math.min(delta, 50));
        const position = this.mario;
        if (position.y > 270 || position.x < -8 || position.x > 232) {
            const lives = this.hud.values.lives - 1;
            if (lives > 0) this.scene.restart({ hudValues: { ...this.hud.values, lives } });
            else this.scene.start('SplashScene');
            return;
        }
        Level2Scene.prototype.updateCollectibles.call(this);
        this.updateRivets();
        if (this.finished) return;
        this.updateFlames(delta);
        this.updateHammer();
        this.checkFlameCollision();
    }
}
