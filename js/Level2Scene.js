import GameHud from './GameHud.js';
import createRollerAnimations from './RollerAnimations.js';
import createKongAnimations from './KongAnimations.js';
import createPaulineAnimations from './PaulineAnimations.js';
import createMarioAnimations, { showLadderTransition } from './MarioAnimations.js';
import MarioPhysics from './MarioPhysics.js';
import FireHunters from './FireHunters.js';
import { GODMODE } from './DebugConfig.js';

// Level 2 layout, conveyor motion, and gameplay.
export default class Level2Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'Level2Scene' });
    }

    preload() {
        this.load.spritesheet('hammer', 'assets/images/hammer.png', {
            frameWidth: 18, frameHeight: 18
        });
        this.load.image('scorefont', 'assets/images/kongfont.png');
        this.load.image('pickup-scores', 'assets/images/scores.png');
        this.load.image('life-icon', 'assets/images/lives.png');
        this.load.image('level-1-props', 'assets/images/sample 2.png');
        this.load.atlas('game-tiles', 'assets/images/game-tiles.png', 'assets/images/game-tiles.json');
        this.load.json('level-2', 'assets/levels/level-2.json');
        this.load.image('level-2-pie', 'assets/images/random-sprites.png');
        this.load.spritesheet('mario', 'assets/images/mario.png', {
            frameWidth: 18,
            frameHeight: 18
        });
        this.load.spritesheet('fire', 'assets/images/fire.png', {
            frameWidth: 18,
            frameHeight: 18
        });
        this.load.spritesheet('pauline', 'assets/images/Pauline.png', {
            frameWidth: 16,
            frameHeight: 23,
            endFrame: 1
        });
        this.load.spritesheet('help', 'assets/images/help.png', {
            frameWidth: 24,
            frameHeight: 9
        });
        this.load.spritesheet('kong', 'assets/images/kong.png', {
            frameWidth: 48,
            frameHeight: 36
        });
        this.load.spritesheet('rollers', 'assets/images/rollers.png', {
            frameWidth: 11,
            frameHeight: 10
        });
    }

    create(data = {}) {
        this.endingStarted = false;
        this.marioDying = false;
        this.marioMovementLocked = false;
        this.heldHammer = null;
        this.hammerTimer = null;
        if (!this.anims.exists('barrel-destroy')) {
            this.anims.create({
                key: 'barrel-destroy',
                frames: this.anims.generateFrameNumbers('hammer', { start: 4, end: 7 }),
                frameRate: 10, repeat: 0
            });
        }
        createRollerAnimations(this.anims);
        createKongAnimations(this.anims);
        createPaulineAnimations(this.anims);
        createMarioAnimations(this.anims);
        this.cursors = this.input.keyboard.createCursorKeys();
        if (!this.anims.exists('oil-flame')) {
            this.anims.create({
                key: 'oil-flame',
                frames: this.anims.generateFrameNumbers('fire', { start: 8, end: 11 }),
                frameRate: 8,
                repeat: -1
            });
        }
        const layout = this.cache.json.get('level-2');
        this.paulineGirder = layout.platforms.reduce((top, platform) => platform.y < top.y ? platform : top);
        const paulineTexture = this.textures.get('pauline');
        if (!paulineTexture.has('heart')) paulineTexture.add('heart', 0, 110, 9, 15, 13);
        if (!paulineTexture.has('broken-heart')) paulineTexture.add('broken-heart', 0, 127, 9, 16, 13);
        this.conveyorPlatforms = layout.platforms.filter(platform => platform.frame === 'conveyor');
        this.conveyorTileSize = layout.tileSize;
        this.topConveyorY = Math.min(...this.conveyorPlatforms.map(platform => platform.y));
        this.bottomConveyorY = Math.max(...this.conveyorPlatforms.map(platform => platform.y));
        const pieTexture = this.textures.get('level-2-pie');
        if (!pieTexture.has('oil-drum-body')) pieTexture.add('oil-drum-body', 0, 127, 0, 16, 17);
        if (!pieTexture.has('pie')) pieTexture.add('pie', 0, 0, 5, 18, 8);
        this.pies = [];
        const scoreTexture = this.textures.get('pickup-scores');
        if (!scoreTexture.has('300')) scoreTexture.add('300', 0, 48, 0, 24, 8);
        const objectTexture = pieTexture;
        const objectFrames = {
            hat: { x: 145, y: 8, width: 16, height: 9 },
            purse: { x: 166, y: 8, width: 9, height: 9 },
            umbrella: { x: 181, y: 2, width: 16, height: 15 }
        };
        for (const [name, frame] of Object.entries(objectFrames)) {
            if (!objectTexture.has(name)) {
                objectTexture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
            }
        }
        this.level = this.add.container(0, 0);
        const hammerTexture = this.textures.get('hammer');
        if (!hammerTexture.has('pickup')) hammerTexture.add('pickup', 0, 5, 8, 9, 10);
        const addImage = (x, y, frame, textureKey) => {
            const image = this.add.image(x, y, textureKey, frame).setOrigin(0);
            this.level.add(image);
            return image;
        };
        const addTile = (x, y, frame) => addImage(x, y, layout.tiles[frame], 'game-tiles');
        this.platformTiles = layout.platforms.map(platform =>
            Array.from({ length: platform.tiles }, (_, column) =>
                addTile(platform.x + column * layout.tileSize, platform.y, platform.frame)));
        this.ladderObjects = [];
        this.foldingLadderTiles = [];
        this.ladderCycleTime = 0;
        this.laddersFullHeight = true;
        for (const support of layout.supports ?? []) {
            for (let row = 0; row < support.rows; row++) {
                for (let column = 0; column < support.columns; column++) {
                    addTile(support.x + column * layout.tileSize,
                        support.y + row * layout.tileSize, support.frame);
                }
            }
        }
        for (const [entries, frame] of [[layout.ladders, 'ladder'], [layout.beltReturns, 'belt-return']]) {
            for (const entry of entries) {
                for (let offset = 0; offset < entry.height; offset += layout.tileSize) {
                    const tile = addTile(entry.x, entry.y + offset, frame);
                    this.ladderObjects.push(tile);
                    if (entry.folding) {
                        this.foldingLadderTiles.push({ tile, y: entry.y + offset,
                            bottom: entry.y + entry.height });
                    }
                }
            }
        }
        this.objects = new Map();
        this.rollers = [];
        for (const object of layout.objects) {
            if (object.name === 'mario') {
                const x = object.x + object.width / 2;
                const y = object.y + object.height;
                this.mario = this.add.sprite(x, y, 'mario', 0).setOrigin(0.5, 1)
                    .play('mario-idle');
                this.level.add(this.mario);
                this.objects.set(object.name, this.mario);
                const ladders = layout.ladders.map(ladder => ({
                    x: ladder.x, segments: [[ladder.y, ladder.height]],
                    isClimbable: ladder.folding ? () => this.laddersFullHeight : undefined
                }));
                this.marioPhysics = new MarioPhysics(this.platformTiles, layout.tileSize, x, y, ladders,
                    (feetX, feetY) => this.getConveyorVelocity(feetX, feetY),
                    (layout.supports ?? []).map(support => ({
                        x: support.x, y: support.y,
                        width: support.columns * layout.tileSize,
                        height: support.rows * layout.tileSize
                    })), { mergeFlatPlatforms: true });
            } else if (object.name === 'kong') {
                const belt = layout.platforms.find(platform => platform.frame === 'conveyor');
                this.kong = this.add.sprite(object.x + object.width / 2, belt.y, 'kong', 0)
                    .setOrigin(0.5, 1);
                this.level.add(this.kong);
                this.objects.set(object.name, this.kong);
                this.kongSlideLeft = belt.x + this.kong.width / 2;
                this.kongSlideRight = belt.x + belt.tiles * layout.tileSize - this.kong.width / 2;
                this.kongSlideDirection = 1;
                this.kongChestBeating = false;
                this.kongChestDelay = Phaser.Math.Between(4000, 7000);
            } else if (object.name === 'oil-drum') {
                // Exclude the painted flames from the reference image.
                const drumHeight = 17;
                const drumY = object.y + object.height - drumHeight;
                this.oilBarrel = addImage(object.x, drumY, 'oil-drum-body', 'level-2-pie');
                this.objects.set(object.name, this.oilBarrel);
                this.oilFlame = this.add.sprite(object.x + object.width / 2,
                    drumY + 2, 'fire', 8).setOrigin(0.5, 1).play('oil-flame');
                this.level.add(this.oilFlame);
            } else if (object.name === 'pauline') {
                this.pauline = this.add.sprite(object.x + object.width / 2,
                    object.y + object.height, 'pauline', 0).setOrigin(0.5, 1);
                this.paulineHelp = this.add.sprite(this.pauline.x + 10,
                    this.pauline.y - 16, 'help', 0).setOrigin(0, 1).setVisible(false);
                this.level.add([this.pauline, this.paulineHelp]);
                this.objects.set(object.name, this.pauline);
                this.schedulePaulineYell();
            } else if (/^(top|middle|bottom)-(left|right)-roller$/.test(object.name)) {
                const middle = object.name.startsWith('middle-');
                const right = object.name.includes('-right-');
                const direction = object.name.startsWith('top-') || (middle && !right)
                    ? 'clockwise' : 'counter-clockwise';
                // Middle conveyors end on the inside, so their end caps face inward.
                const side = (middle ? !right : right) ? 'right' : 'left';
                // Keep native pixels, aligned to the outer edge and belt center.
                const x = object.x + (side === 'right' ? object.width - 11 : 0);
                const y = object.y + (object.height - 10) / 2;
                const roller = this.add.sprite(x, y, 'rollers', side === 'left' ? 0 : 4)
                    .setOrigin(0)
                    .play(`roller-${side}-${direction}`);
                this.level.add(roller);
                this.objects.set(object.name, roller);
                this.rollers.push(roller);
            } else if (objectFrames[object.name]) {
                const frame = objectFrames[object.name];
                // Preserve the layout's center and baseline at the sprite's native size.
                const x = object.x + (object.width - frame.width) / 2;
                const y = object.y + object.height - frame.height;
                this.objects.set(object.name, addImage(x, y, object.name, 'level-2-pie'));
            } else if (object.name === 'hammer-upper' || object.name === 'hammer-lower') {
                const x = object.x + (object.width - 9) / 2;
                const y = object.y + object.height - 10;
                this.objects.set(object.name, addImage(x, y, 'pickup', 'hammer'));
            }
        }
        this.heart = this.add.image(0, 0, 'pauline', 'heart').setVisible(false);
        this.level.add(this.heart);
        this.spawnPie();
        this.schedulePie();
        this.fireHunters = new FireHunters(this, {
            level: layout,
            heightAt: (x, platform) => platform.y,
            maxHunters: 6,
            patrolRow: layout.platforms.findIndex(platform =>
                platform.frame === 'conveyor' && platform.y === this.topConveyorY),
            spawnTarget: () => {
                const startX = this.oilBarrel.x + this.oilBarrel.width / 2;
                const x = startX + (Phaser.Math.Between(0, 1) === 0 ? -26 : 26);
                // Land on either middle conveyor beside the oil barrel.
                const row = layout.platforms.findIndex(platform => platform.frame === 'conveyor' &&
                    Math.abs(platform.y - this.oilBarrel.y) <= 2 &&
                    x >= platform.x && x < platform.x + platform.tiles * layout.tileSize);
                return { row, x };
            }
        });
        this.hud = new GameHud(this, this.level);
        this.hud.setValues({ ...data.hudValues, level: 2, bonus: 5000 });
        const fitLevel = () => {
            const { width, height } = this.scale;
            const scale = Math.min(width / layout.width, height / layout.height);
            this.level.setScale(scale).setPosition(
                (width - layout.width * scale) / 2, (height - layout.height * scale) / 2);
        };
        fitLevel();
        this.scale.on('resize', fitLevel);
        this.events.once('shutdown', () => {
            this.scale.off('resize', fitLevel);
            this.paulineYellTimer?.remove();
            this.pieTimer?.remove();
            this.clearHammer();
            this.fireHunters?.destroy();
            this.pies.forEach(pie => pie.destroy());
            this.pies = [];
            this.pauline?.removeAllListeners('animationcomplete-pauline-yelling');
            this.marioPhysics = null;
        });
    }

    schedulePaulineYell() {
        this.paulineYellTimer = this.time.delayedCall(Phaser.Math.Between(4000, 9000), () => {
            if (!this.pauline?.active || this.endingStarted || this.finished || this.marioDying) return;
            this.pauline.once('animationcomplete-pauline-yelling', () => {
                this.pauline.setFrame(0);
                this.paulineHelp.setVisible(false);
                this.schedulePaulineYell();
            });
            this.paulineHelp.setVisible(true);
            this.pauline.play('pauline-yelling');
        });
    }

    schedulePie() {
        this.pieTimer = this.time.delayedCall(Phaser.Math.Between(1800, 3500), () => {
            this.spawnPie();
            this.schedulePie();
        });
    }

    updateCollectibles() {
        if (!this.mario?.active) return;
        for (const name of ['hat', 'purse', 'umbrella']) {
            const object = this.objects.get(name);
            if (!object?.active) continue;
            // Mario's body and the collectibles share level-local coordinates.
            const overlaps = this.mario.x + 5 >= object.x &&
                this.mario.x - 5 <= object.x + object.width &&
                this.mario.y >= object.y && this.mario.y - 16 <= object.y + object.height;
            if (!overlaps) continue;
            const popup = this.add.image(object.x + object.width / 2,
                object.y + object.height / 2, 'pickup-scores', '300');
            this.level.add(popup);
            this.time.delayedCall(600, () => popup.destroy());
            object.destroy();
            this.objects.delete(name);
            const score = this.hud.values.score + 300;
            this.hud.setValues({ score, highScore: Math.max(score, this.hud.values.highScore) });
        }
    }

    spawnPie() {
        const belt = Phaser.Utils.Array.GetRandom(this.conveyorPlatforms);
        const left = belt.x;
        const right = left + belt.tiles * this.conveyorTileSize;
        const halfWidth = 9;
        const x = Phaser.Math.Between(0, 1) === 0 ? left + halfWidth : right - halfWidth;
        if (this.isPieNearKong(x, belt.y, halfWidth)) return;
        const pie = this.add.image(x, belt.y, 'level-2-pie', 'pie').setOrigin(0.5, 1);
        pie.belt = belt;
        this.level.add(pie);
        this.pies.push(pie);
    }

    isPieNearKong(x, y, halfWidth) {
        const margin = 8;
        return this.kong && Math.abs(y - this.kong.y) <= 2 &&
            Math.abs(x - this.kong.x) < this.kong.width / 2 + halfWidth + margin;
    }

    updatePies(delta) {
        for (let index = this.pies.length - 1; index >= 0; index--) {
            const pie = this.pies[index];
            const belt = pie.belt;
            const right = belt.x + belt.tiles * this.conveyorTileSize;
            // Sample the belt center so pies keep moving while crossing its edge.
            pie.x += this.getConveyorVelocity((belt.x + right) / 2, belt.y) * delta / 1000;
            const flame = this.oilFlame;
            // Both sprites use level-local coordinates, independent of display scaling.
            const touchesFire = flame?.visible &&
                pie.x + pie.width / 2 >= flame.x - flame.width / 2 &&
                pie.x - pie.width / 2 <= flame.x + flame.width / 2 &&
                pie.y >= flame.y - flame.height && pie.y - pie.height <= flame.y;
            if (pie.x < belt.x || pie.x >= right || touchesFire ||
                this.isPieNearKong(pie.x, pie.y, pie.width / 2)) {
                pie.destroy();
                this.pies.splice(index, 1);
            }
        }
    }

    updateFoldingLadders(delta) {
        // Four seconds extended, 0.8 seconds folding, two seconds folded, then extend.
        this.ladderCycleTime = (this.ladderCycleTime + delta) % 7600;
        const phase = this.ladderCycleTime;
        this.laddersFullHeight = phase < 4000;
        const height = phase < 4000 ? 1
            : phase < 4800 ? 1 - (phase - 4000) / 1600
            : phase < 6800 ? 0.5 : 0.5 + (phase - 6800) / 1600;
        for (const { tile, y, bottom } of this.foldingLadderTiles) {
            tile.y = bottom - (bottom - y) * height;
            tile.setScale(1, height);
        }
    }

    updateEnding() {
        const platform = this.paulineGirder;
        if (this.endingStarted || !this.marioPhysics.grounded ||
            this.mario.x < platform.x || this.mario.x >= platform.x + platform.tiles * this.conveyorTileSize ||
            Math.abs(this.mario.y - platform.y) >= 2) return;
        this.endingStarted = true;
        this.marioMovementLocked = true;
        this.clearHammer();
        this.marioPhysics.body.setLinearVelocity(planck.Vec2(0, 0));
        this.mario.anims.stop();
        this.mario.setFrame(0).setFlipX(this.mario.x > this.pauline.x);
        this.paulineYellTimer?.remove();
        this.pauline.removeAllListeners('animationcomplete-pauline-yelling');
        this.pauline.anims.stop();
        this.pauline.setFrame(0);
        this.paulineHelp.setVisible(false);
        this.heart.setPosition((this.mario.x + this.pauline.x) / 2,
            Math.min(this.mario.y, this.pauline.y) - 18).setVisible(true);
        this.pieTimer?.remove();
        this.pies.forEach(pie => pie.destroy());
        this.pies = [];
        this.fireHunters.destroy();
        this.kong.anims.stop();
        this.kong.setFlipX(false).setFrame(6);
        this.level.bringToTop(this.kong);

        const layout = this.cache.json.get('level-2');
        const ladders = layout.ladders.filter(ladder => ladder.x < platform.x && ladder.y < platform.y);
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
                            height: 75, resumeGame: false,
                            previousScene: 'Level2Scene', nextScene: 'Level3Scene',
                            hudValues: { ...this.hud.values }
                        });
                        this.scene.sleep();
                    });
                }
            });
        });
    }

    update(time, delta) {
        if (!this.kong || this.marioMovementLocked) return;
        this.kongChestDelay -= delta;
        if (this.kongChestBeating) {
            if (this.kongChestDelay <= 0) {
                this.kong.anims.stop();
                this.kong.setFrame(0);
                this.kongChestBeating = false;
                this.kongChestDelay = Phaser.Math.Between(4000, 7000);
            }
        } else if (this.kongChestDelay <= 0) {
            this.kongChestBeating = true;
            this.kongChestDelay = 1400;
            this.kong.play({ key: 'kong-chest-beat', repeat: 1 });
        }

        this.kong.x += this.kongSlideDirection * 24 * delta / 1000;
        if (this.kong.x >= this.kongSlideRight) {
            this.kong.x = this.kongSlideRight;
            this.kongSlideDirection = -1;
        } else if (this.kong.x <= this.kongSlideLeft) {
            this.kong.x = this.kongSlideLeft;
            this.kongSlideDirection = 1;
        }
        const direction = this.kongSlideDirection > 0 ? 'clockwise' : 'counter-clockwise';
        const bottomDirection = this.kongSlideDirection > 0 ? 'counter-clockwise' : 'clockwise';
        for (const side of ['left', 'right']) {
            this.objects.get(`top-${side}-roller`).play(`roller-${side}-${direction}`, true);
            this.objects.get(`bottom-${side}-roller`).play(`roller-${side}-${bottomDirection}`, true);
        }
        this.updateFoldingLadders(delta);
        this.updateMario(delta);
        this.updateEnding();
        if (this.endingStarted) return;
        this.updateCollectibles();
        this.updatePies(delta);
        this.fireHunters.update(delta);
        this.updateHammer();
        this.checkEnemyCollision();
    }

    checkEnemyCollision() {
        if (GODMODE || this.marioDying || this.endingStarted) return false;
        const hitPie = this.pies.some(pie => pie.active &&
            Math.abs(this.mario.x - pie.x) < 5 + pie.width / 2 &&
            this.mario.y > pie.y - pie.height && this.mario.y - 16 < pie.y);
        const hitFlame = this.fireHunters.hunters.some(({ sprite }) => sprite.active &&
            Math.abs(this.mario.x - sprite.x) < 11 &&
            this.mario.y > sprite.y - 14 && this.mario.y - 16 < sprite.y);
        if (!hitPie && !hitFlame) return false;
        this.marioDying = true;
        this.marioMovementLocked = true;
        const lives = Math.max(0, this.hud.values.lives - 1);
        this.hud.setValues({ lives });
        this.marioPhysics.body.setLinearVelocity(planck.Vec2(0, 0));
        this.clearHammer();
        this.time.removeAllEvents();
        this.tweens.pauseAll();
        for (const sprite of [this.kong, this.pauline, this.oilFlame, ...this.rollers,
            ...this.fireHunters.hunters.map(hunter => hunter.sprite)]) {
            sprite?.anims.pause();
        }
        this.paulineHelp.setVisible(false);
        this.mario.once('animationcomplete-mario-dies', () => {
            if (lives > 0) this.scene.restart({ hudValues: { ...this.hud.values } });
            else this.scene.start('SplashScene');
        });
        this.mario.play('mario-dies');
        this.mario.anims.resume();
        return true;
    }

    getConveyorVelocity(x, feetY) {
        const belt = this.conveyorPlatforms.find(platform =>
            x >= platform.x && x < platform.x + platform.tiles * this.conveyorTileSize &&
            Math.abs(feetY - platform.y) <= 2);
        if (!belt) return 0;
        if (belt.y === this.topConveyorY) return this.kongSlideDirection * 24;
        if (belt.y === this.bottomConveyorY) return -this.kongSlideDirection * 24;
        // Split middle belts carry their riders toward the oil drum.
        return belt.x === Math.min(...this.conveyorPlatforms.filter(platform => platform.y === belt.y)
            .map(platform => platform.x)) ? 24 : -24;
    }

    clearHammer() {
        this.hammerTimer?.remove();
        this.hammerTimer = null;
        this.heldHammer?.destroy();
        this.heldHammer = null;
    }

    pickUpHammer() {
        if (this.heldHammer || !this.marioPhysics.isJumping) return;
        for (const name of ['hammer-upper', 'hammer-lower']) {
            const hammer = this.objects.get(name);
            if (!hammer?.active || this.mario.x + 5 < hammer.x ||
                this.mario.x - 5 > hammer.x + hammer.width || this.mario.y < hammer.y ||
                this.mario.y - 16 > hammer.y + hammer.height) continue;
            hammer.destroy();
            this.objects.delete(name);
            this.heldHammer = this.add.sprite(this.mario.x, this.mario.y, 'hammer', 0);
            this.level.add(this.heldHammer);
            this.hammerTimer = this.time.delayedCall(8000, () => {
                this.clearHammer();
                this.mario.play('mario-idle');
            });
            break;
        }
    }

    updateHammer() {
        if (!this.heldHammer) return;
        const direction = this.mario.flipX ? -1 : 1;
        const horizontal = Number(this.mario.frame.name) >= 15;
        const gripX = horizontal ? 2 : 9;
        const gripY = horizontal ? 11 : 17;
        const handX = this.mario.x + direction * (horizontal ? 6 : -1);
        const handY = this.mario.y - (horizontal ? 7 : 15);
        this.heldHammer.setFrame(horizontal ? 1 : 0).setFlipX(this.mario.flipX)
            .setOrigin((direction < 0 ? 18 - gripX : gripX) / 18, gripY / 18)
            .setPosition(handX, handY);
        const headX = handX + (horizontal ? direction * 9 : 0);
        const headY = handY - (horizontal ? 0 : 6);
        const smash = (sprite, halfHeight) => {
            if (!sprite.active || Math.abs(sprite.x - headX) > 10 ||
                Math.abs(sprite.y - halfHeight - headY) > 10) return false;
            const effect = this.add.sprite(sprite.x, sprite.y - halfHeight, 'hammer', 4);
            this.level.add(effect);
            effect.once('animationcomplete-barrel-destroy', () => effect.destroy());
            effect.play('barrel-destroy');
            sprite.destroy();
            return true;
        };
        if (this.pies) this.pies = this.pies.filter(pie => !smash(pie, pie.height / 2));
        this.fireHunters.hunters = this.fireHunters.hunters.filter(hunter => {
            if (!smash(hunter.sprite, 7)) return true;
            hunter.hopTween?.stop();
            return false;
        });
    }

    updateMario(delta) {
        if (!this.mario || !this.marioPhysics) return;
        const direction = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const position = this.marioPhysics.update(delta, direction,
            !this.heldHammer && this.cursors.up.isDown, !this.heldHammer && this.cursors.down.isDown,
            Phaser.Input.Keyboard.JustDown(this.cursors.space));
        this.mario.setPosition(position.x, position.y);
        this.pickUpHammer();
        if (this.heldHammer) {
            if (direction !== 0) this.mario.setFlipX(direction < 0);
            this.mario.play('mario-hammer', true);
            this.mario.anims.resume();
        } else if (this.marioPhysics.climbing) {
            this.mario.setFlipX(false);
            this.mario.play('mario-climb', true);
            if (this.marioPhysics.climbMoving) this.mario.anims.resume();
            else this.mario.anims.pause();
        } else {
            if (direction !== 0) this.mario.setFlipX(direction < 0);
            const animation = !this.marioPhysics.grounded ? 'mario-jump'
                : direction !== 0 ? 'mario-run' : 'mario-idle';
            this.mario.play(animation, true);
            this.mario.anims.resume();
        }
        showLadderTransition(this.mario, this.marioPhysics);
        const noInput = !['left', 'right', 'up', 'down', 'space']
            .some(key => this.cursors[key].isDown);
        if (noInput && this.marioPhysics.grounded && !this.marioPhysics.climbing &&
            this.getConveyorVelocity?.(position.x, position.y)) {
            this.mario.anims.pause();
        }
    }

}
