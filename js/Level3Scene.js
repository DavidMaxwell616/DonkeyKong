import Level2Scene from './Level2Scene.js';
import GameHud from './GameHud.js';
import MarioPhysics from './MarioPhysics.js';
import FireHunters from './FireHunters.js';
import createMarioAnimations, { showLadderTransition } from './MarioAnimations.js';
import createKongAnimations from './KongAnimations.js';
import createPaulineAnimations from './PaulineAnimations.js';
import { GODMODE } from './DebugConfig.js';

const SPRING_HOP_DURATION = 0.65;
const SPRING_HOP_HEIGHT = 28;

export default class Level3Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'Level3Scene' });
    }

    preload() {
        Level2Scene.prototype.preload.call(this);
        this.load.json('level-3', 'assets/levels/level-3.json');
        this.load.spritesheet('spring', 'assets/images/random-sprites.png', {
            frameWidth: 18, frameHeight: 18
        });
    }

    create(data = {}) {
        const layout = this.cache.json.get('level-3');
        this.finished = false;
        this.marioDying = false;
        this.springs = [];
        this.springSpawnDelay = 2000;
        this.springPlatform = layout.platforms[1];
        this.springBottom = layout.height + 18;
        this.objects = new Map();
        const paulineTexture = this.textures.get('pauline');
        if (!paulineTexture.has('heart')) paulineTexture.add('heart', 0, 110, 9, 15, 13);
        if (!paulineTexture.has('broken-heart')) paulineTexture.add('broken-heart', 0, 127, 9, 16, 13);
        const scoreTexture = this.textures.get('pickup-scores');
        if (!scoreTexture.has('300')) scoreTexture.add('300', 0, 48, 0, 24, 8);
        this.cameras.main.setBackgroundColor('#000000');
        createMarioAnimations(this.anims);
        createKongAnimations(this.anims);
        createPaulineAnimations(this.anims);
        this.level = this.add.container(0, 0);
        const tile = (x, y, frame) => {
            const object = this.add.image(x, y, 'game-tiles', frame).setOrigin(0);
            this.level.add(object);
            return object;
        };
        const platforms = layout.platforms.map(row => Array.from({ length: row.tiles },
            (_, column) => tile(row.x + column * 8, row.y, 'girder-pink')));
        for (const ladder of layout.ladders) {
            for (const [y, height] of ladder.segments) {
                for (let offset = 0; offset < height; offset += 8) {
                    tile(ladder.x, y + offset, 'ladder-cyan');
                }
            }
        }
        const props = this.textures.get('level-2-pie');
        for (const [name, x, y, width, height] of [
            ['elevator-end', 91, 1, 16, 16],
            ['umbrella', 181, 2, 16, 15],
            ['purse', 166, 8, 9, 9]
        ]) {
            if (!props.has(name)) props.add(name, 0, x, y, width, height);
        }
        const addProp = (name, x, y) => {
            const object = this.add.image(x, y, 'level-2-pie', name).setOrigin(0);
            this.level.add(object);
            return object;
        };
        for (const x of [32, 96]) {
            // Draw unobstructed guide rails; moving platforms are separate objects.
            this.level.add(this.add.rectangle(x + 7, 104, 2, 135, 0xa82525).setOrigin(0));
        }
        this.objects.set('umbrella', addProp('umbrella', 4, 121));
        this.objects.set('purse', addProp('purse', 208.5, 199));
        this.kong = this.add.sprite(44, 88, 'kong', 0).setOrigin(0.5, 1).play('kong-chest-beat');
        this.pauline = this.add.sprite(96, 56, 'pauline', 0).setOrigin(0.5, 1);
        this.mario = this.add.sprite(12, 232, 'mario', 0).setOrigin(0.5, 1);
        this.level.add([this.kong, this.pauline, this.mario]);
        this.paulineHelp = this.add.sprite(this.pauline.x + 10,
            this.pauline.y - 16, 'help', 0).setOrigin(0, 1).setVisible(false);
        this.level.add(this.paulineHelp);
        this.schedulePaulineYell();
        this.heart = this.add.image(0, 0, 'pauline', 'heart').setVisible(false);
        this.level.add(this.heart);
        this.marioPhysics = new MarioPhysics(platforms, 8, 12, 232, layout.ladders);
        this.fireHunters = new FireHunters(this, {
            level: layout, heightAt: (x, platform) => platform.y, autoSpawn: false
        });
        for (const { row, x } of layout.hunterSpawns) this.fireHunters.spawnAt(row, x);
        this.lifts = [];
        for (const [x, direction] of [[32, -1], [96, 1]]) {
            for (let index = 0; index < 3; index++) {
                const y = 112 + index * 52;
                const images = [tile(x, y, 'girder-pink'), tile(x + 8, y, 'girder-pink')];
                const body = this.marioPhysics.world.createKinematicBody({
                    position: planck.Vec2((x + 8) / 16, (y + 4) / 16)
                });
                const fixture = body.createFixture(planck.Box(0.5, 0.25), {
                    friction: 0, userData: { platformTop: y }
                });
                this.lifts.push({ x, y, direction, images, body, fixture });
            }
        }
        // Keep the wheels and yellow housings in front of passing lift platforms.
        for (const x of [32, 96]) {
            addProp('elevator-end', x, 88);
            addProp('elevator-end', x, 239).setFlipY(true);
        }
        this.cursors = this.input.keyboard.createCursorKeys();
        this.hud = new GameHud(this, this.level);
        this.hud.setValues({ ...data.hudValues, level: 3, bonus: 5000 });
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
            this.scale.off('resize', fit);
            this.marioPhysics = null;
            this.lifts = [];
            this.springs.forEach(spring => spring.sprite.destroy());
            this.springs = [];
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

    spawnSpring() {
        const platform = this.springPlatform;
        const entryX = platform.x + 10;
        // Clear the full 18-pixel sprite past the platform before dropping.
        const dropX = platform.x + platform.tiles * 8 + 10;
        // Entry is halfway through hop one: 3.5 equal hops remain to the drop.
        const hopDistance = (dropX - entryX) / 3.5;
        const endX = dropX - hopDistance;
        // The unseen first half-hop starts offscreen; its apex is the entry point.
        const startX = (6 * entryX - endX) / 5;
        const sprite = this.add.sprite(entryX, platform.y - SPRING_HOP_HEIGHT, 'spring', 3)
            .setOrigin(0.5, 1);
        this.level.add(sprite);
        this.springs.push({ sprite, startX, endX, dropX, elapsed: SPRING_HOP_DURATION / 2 });
    }

    updateSprings(delta) {
        const dt = Math.min(delta, 50) / 1000;
        this.springSpawnDelay -= dt * 1000;
        if (this.springSpawnDelay <= 0) {
            this.spawnSpring();
            this.springSpawnDelay = 3500;
        }
        const bounceDuration = SPRING_HOP_DURATION;
        const contactDuration = 0.08;
        const cycleDuration = bounceDuration + contactDuration;
        const bounceTime = cycleDuration * 3;
        const exitDuration = bounceDuration;
        for (let index = this.springs.length - 1; index >= 0; index--) {
            const spring = this.springs[index];
            spring.elapsed += dt;
            if (spring.elapsed < bounceTime) {
                const bounce = Math.floor(spring.elapsed / cycleDuration);
                const phase = Math.min((spring.elapsed % cycleDuration) / bounceDuration, 1);
                // Compress on contact, then extend for the next flight.
                spring.sprite.setFrame(phase === 1 ? 4 : 3);
                spring.sprite.x = spring.startX + (spring.endX - spring.startX) * (bounce + phase) / 3;
                spring.sprite.y = this.springPlatform.y - SPRING_HOP_HEIGHT * 4 * phase * (1 - phase);
            } else if (spring.elapsed < bounceTime + exitDuration) {
                // Complete the exit hop beyond the edge before dropping vertically.
                const phase = (spring.elapsed - bounceTime) / exitDuration;
                spring.sprite.setFrame(3);
                spring.sprite.x = spring.endX + (spring.dropX - spring.endX) * phase;
                spring.sprite.y = this.springPlatform.y - SPRING_HOP_HEIGHT * 4 * phase * (1 - phase);
            } else {
                const fallTime = spring.elapsed - bounceTime - exitDuration;
                spring.sprite.setFrame(3);
                spring.sprite.x = spring.dropX;
                const fallSpeed = 4 * SPRING_HOP_HEIGHT / exitDuration;
                spring.sprite.y = this.springPlatform.y + fallSpeed * fallTime + 0.5 * 280 * fallTime * fallTime;
            }
            if (spring.sprite.y > this.springBottom) {
                spring.sprite.destroy();
                this.springs.splice(index, 1);
            }
        }
    }

    checkEnemyCollision() {
        if (GODMODE || this.marioDying || this.finished) return false;
        const enemies = [...this.springs, ...this.fireHunters.hunters];
        const overlaps = (sprite, height) => sprite.active &&
            Math.abs(this.mario.x - sprite.x) < 11 &&
            this.mario.y > sprite.y - height && this.mario.y - 16 < sprite.y;
        const hit = this.springs.some(({ sprite }) => overlaps(sprite, 12)) ||
            this.fireHunters.hunters.some(({ sprite }) => overlaps(sprite, 14));
        if (!hit) return false;
        this.marioDying = true;
        this.stopPaulineYell();
        const lives = Math.max(0, this.hud.values.lives - 1);
        this.hud.setValues({ lives });
        for (const { sprite } of enemies) sprite.anims.pause();
        this.mario.once('animationcomplete-mario-dies', () => {
            if (lives > 0) this.scene.restart({ hudValues: { ...this.hud.values } });
            else this.scene.start('SplashScene');
        });
        this.mario.play('mario-dies');
        this.mario.anims.resume();
        return true;
    }

    startEnding() {
        if (this.finished) return;
        this.finished = true;
        this.stopPaulineYell();
        this.marioPhysics.body.setLinearVelocity(planck.Vec2(0, 0));
        this.mario.anims.stop();
        this.mario.setFrame(0).setFlipX(this.mario.x > this.pauline.x);
        this.pauline.anims.stop();
        this.pauline.setFrame(0);
        this.heart.setPosition((this.mario.x + this.pauline.x) / 2,
            Math.min(this.mario.y, this.pauline.y) - 18).setVisible(true);
        this.springs.forEach(spring => spring.sprite.destroy());
        this.springs = [];
        this.fireHunters.destroy();
        const score = this.hud.values.score + this.hud.values.bonus;
        this.hud.setValues({ score, highScore: Math.max(score, this.hud.values.highScore), bonus: 0 });
        const platform = this.cache.json.get('level-3').platforms[0];
        this.kong.anims.stop();
        this.kong.setFlipX(false).setFrame(6);
        this.level.bringToTop(this.kong);

        const layout = this.cache.json.get('level-3');
        const ladders = layout.ladders.flatMap(ladder => ladder.segments.map(([y, height]) => ({ x: ladder.x, y, height }))).filter(ladder => ladder.x < platform.x && ladder.y < platform.y);
        const climbX = ladders.reduce((sum, ladder) => sum + ladder.x + layout.tileSize / 2, 0) / ladders.length;
        const climbBottom = Math.max(...ladders.map(ladder => ladder.y + ladder.height));
        const climbTop = Math.min(...ladders.map(ladder => ladder.y));
        this.time.delayedCall(600, () => {
            this.kong.setPosition(climbX, climbBottom).play('kong-climb');
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            const updateMask = () => graphics.clear().fillStyle(0xffffff).fillRect(
                this.level.x, this.level.y + climbTop * this.level.scaleY,
                layout.width * this.level.scaleX, (layout.height - climbTop) * this.level.scaleY);
            updateMask();
            const mask = graphics.createGeometryMask();
            this.kong.setMask(mask);
            this.scale.on('resize', updateMask);
            const clearMask = () => {
                this.scale.off('resize', updateMask);
                this.kong.clearMask();
                mask.destroy();
                graphics.destroy();
            };
            this.events.once('shutdown', clearMask);
            let carryingPauline = false;
            this.tweens.add({
                targets: this.kong, y: climbTop,
                duration: (climbBottom - climbTop) / 30 * 1000, ease: 'Linear',
                onUpdate: () => {
                    if (!carryingPauline && this.kong.y <= this.pauline.y + 12) {
                        carryingPauline = true;
                        this.pauline.setVisible(false);
                        this.kong.play('kong-climb-pauline');
                    }
                },
                onComplete: () => {
                    this.kong.anims.stop();
                    this.kong.setVisible(false);
                    this.events.off('shutdown', clearMask);
                    clearMask();
                    this.heart.setFrame('broken-heart');
                    this.time.delayedCall(1200, () => {
                        this.scene.launch('IntermissionScene', {
                            height: 100, resumeGame: false,
                            previousScene: 'Level3Scene', nextScene: 'Level4Scene',
                            hudValues: { ...this.hud.values }
                        });
                        this.scene.sleep();
                    });
                }
            });
        });
    }

    update(time, delta) {
        if (this.finished || this.marioDying || !this.marioPhysics) return;
        const dt = Math.min(delta, 50) / 1000;
        for (const lift of this.lifts) {
            const previousY = lift.y;
            lift.y += lift.direction * 22 * dt;
            const wrapped = lift.y < 104 || lift.y > 248;
            if (lift.y < 104) lift.y += 144;
            if (lift.y > 248) lift.y -= 144;
            const physics = this.marioPhysics;
            if (!wrapped && !physics.climbing && this.mario.x >= lift.x - 3 &&
                this.mario.x <= lift.x + 19 && Math.abs(this.mario.y - previousY) < 2 &&
                physics.body.getLinearVelocity().y >= 0) {
                const position = physics.body.getPosition();
                physics.body.setPosition(planck.Vec2(position.x, position.y + (lift.y - previousY) / 16));
                physics.previousFeetY += lift.y - previousY;
            }
            lift.body.setPosition(planck.Vec2((lift.x + 8) / 16, (lift.y + 4) / 16));
            lift.fixture.setUserData({ platformTop: lift.y });
            lift.images.forEach(image => { image.y = lift.y; });
        }
        const direction = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const position = this.marioPhysics.update(Math.min(delta, 50), direction,
            this.cursors.up.isDown, this.cursors.down.isDown,
            Phaser.Input.Keyboard.JustDown(this.cursors.space));
        this.mario.setPosition(position.x, position.y);
        this.updateSprings(delta);
        this.fireHunters.update(Math.min(delta, 50));
        if (this.checkEnemyCollision()) return;
        Level2Scene.prototype.updateCollectibles.call(this);
        if (direction) this.mario.setFlipX(direction < 0);
        const physics = this.marioPhysics;
        this.mario.play(physics.climbing ? 'mario-climb' : !physics.grounded ? 'mario-jump'
            : direction ? 'mario-run' : 'mario-idle', true);
        if (physics.climbing && !physics.climbMoving) this.mario.anims.pause();
        else this.mario.anims.resume();
        showLadderTransition(this.mario, physics);
        if (position.y > 270 || position.x < -8 || position.x > 232) {
            const lives = this.hud.values.lives - 1;
            if (lives > 0) this.scene.restart({ hudValues: { ...this.hud.values, lives } });
            else this.scene.start('SplashScene');
            return;
        }
        if (physics.grounded && position.x >= 88 && position.x <= 136 && Math.abs(position.y - 56) < 2) {
            this.startEnding();
        }
    }
}
