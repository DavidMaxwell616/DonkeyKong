import createKongAnimations from './KongAnimations.js';
import createBarrelAnimations from './BarrelAnimations.js';
import createMarioAnimations, { showLadderTransition } from './MarioAnimations.js';
import createPaulineAnimations from './PaulineAnimations.js';
import MarioPhysics from './MarioPhysics.js';
import GameHud from './GameHud.js';
import FireHunters from './FireHunters.js';

import { GODMODE } from './DebugConfig.js';

export default class GameScene extends Phaser.Scene {
    constructor(key = 'GameScene') {
        super({ key });
    }

    preload() {
        this.load.spritesheet('hammer', 'assets/images/hammer.png', {
            frameWidth: 18,
            frameHeight: 18
        });
        this.load.spritesheet('help', 'assets/images/help.png', {
            frameWidth: 24,
            frameHeight: 9
        });
        this.load.spritesheet('barrels', 'assets/images/barrels.png', {
            frameWidth: 18,
            frameHeight: 18
        });
        this.load.spritesheet('fire', 'assets/images/fire.png', {
            frameWidth: 18,
            frameHeight: 18
        });
        this.load.image('scorefont', 'assets/images/kongfont.png');
        this.load.image('random-sprites', 'assets/images/random-sprites.png');
        this.load.image('life-icon', 'assets/images/lives.png');
        this.load.spritesheet('mario', 'assets/images/mario.png', {
            frameWidth: 18,
            frameHeight: 18
        });
        this.load.atlas('game-tiles', 'assets/images/game-tiles.png', 'assets/images/game-tiles.json');
        this.load.json('level-1', 'assets/levels/level-1.json');
        this.load.json('girder-changes', 'assets/levels/level-1-girder-changes.json');
        this.load.json('level-1-details', 'assets/levels/level-1-details.json');
        this.load.image('level-1-props', 'assets/images/sample 2.png');
        this.load.spritesheet('kong', 'assets/images/kong.png', {
            frameWidth: 48,
            frameHeight: 36
        });
        this.load.spritesheet('pauline', 'assets/images/Pauline.png', {
            frameWidth: 16,
            frameHeight: 23,
            endFrame: 1
        });
    }

    create(data = {}) {
        this.lives = data.lives ?? 3;
        this.marioDying = false;
        this.pauline = null;
        this.paulineHelp = null;
        this.mario = null;
        this.marioMovementLocked = !data.skipIntro;
        this.marioPhysics = null;
        this.barrelThrowTimer = null;
        this.barrels = new Set();
        this.jumpScoredBarrels = new Set();
        this.endingStarted = false;
        this.fireHunters = null;
        this.heldHammer = null;
        this.hammerTimer = null;
        this.paulineYellTimer = null;
        this.events.once('shutdown', () => { this.marioPhysics = null; });
        this.cursors = this.input.keyboard.createCursorKeys();
        const level = this.cache.json.get('level-1');
        this.level = this.add.container(0, 0);
        this.levelDetails = null;

        const addTile = (x, y, frame, height = level.tileSize) => {
            const tile = this.add.image(x, y, 'game-tiles', frame).setOrigin(0);
            if (height < level.tileSize) {
                tile.setCrop(0, 0, level.tileSize, height);
            }
            this.level.add(tile);
            return tile;
        };

        this.platformTiles = [];
        for (const platform of level.platforms) {
            const tiles = [];
            for (let column = 0; column < platform.tiles; column++) {
                tiles.push(addTile(platform.x + column * level.tileSize, platform.y, platform.frame));
            }
            this.platformTiles.push(tiles);
        }

        this.ladderObjects = [];
        for (const ladder of level.ladders) {
            // Ladders pass through the girders in the reference layout.
            const backing = this.add.rectangle(
                ladder.x, ladder.y, level.tileSize, ladder.height, 0x000000
            ).setOrigin(0);
            this.level.add(backing);
            const objects = [backing];
            for (let offset = 0; offset < ladder.height; offset += level.tileSize) {
                objects.push(addTile(ladder.x, ladder.y + offset, ladder.frame,
                    Math.min(level.tileSize, ladder.height - offset)));
            }
            this.ladderObjects.push({ ladder, objects });
        }

        createKongAnimations(this.anims);
        createBarrelAnimations(this.anims);
        createPaulineAnimations(this.anims);
        const climbLadder = level.ladders.reduce((longest, ladder) =>
            ladder.height > longest.height ? ladder : longest);
        const climbLadders = level.ladders.filter(ladder =>
            ladder.y === climbLadder.y && ladder.height === climbLadder.height);
        const ladderLeft = Math.min(...climbLadders.map(ladder => ladder.x));
        const ladderRight = Math.max(...climbLadders.map(ladder => ladder.x + level.tileSize));
        const climbX = (ladderLeft + ladderRight) / 2;
        const startY = climbLadder.y + climbLadder.height;

        this.kong = this.add.sprite(climbX, startY, 'kong', 12).setOrigin(0.5, 1);
        this.level.add(this.kong);
        if (!data.skipIntro) {
            this.kong.play('kong-climb-pauline');

            // With a bottom origin, stop one sprite height below the ladder's top.
            // This places Kong's head at the underside of the girder above it.
            const stopY = climbLadder.y + this.kong.height;
            const climbSpeed = 24; // Level pixels per second, independent of display scale.
            this.tweens.add({
                targets: this.kong,
                y: stopY,
                duration: Math.max(0, startY - stopY) / climbSpeed * 1000,
                ease: 'Linear',
                onComplete: () => {
                    this.kong.anims.stop();
                    this.kong.setFrame(12);
                    this.jumpOntoGirder(level, climbLadder);
                }
            });
        }

        const fitLevel = () => {
            const { width, height } = this.scale;
            const scale = Math.min(width / level.width, height / level.height);
            this.level.setScale(scale);
            this.level.setPosition((width - level.width * scale) / 2,
                (height - level.height * scale) / 2);
        };
        fitLevel();
        this.hud = new GameHud(this, this.level);
        this.hud.setValues({ ...data.hudValues, lives: this.lives });
        this.scale.on('resize', fitLevel);
        this.events.once('shutdown', () => this.scale.off('resize', fitLevel));

        if (data.skipIntro) {
            const topGirder = level.platforms.find(platform =>
                platform.y + level.tileSize === climbLadder.y);
            const miniGirder = level.platforms.reduce((highest, platform) =>
                platform.y < highest.y ? platform : highest);
            this.ladderObjects = this.ladderObjects.filter(entry => {
                if (entry.ladder.y < climbLadder.y) return true;
                entry.objects.forEach(object => object.destroy());
                return false;
            });
            this.kong.setPosition(topGirder.x + 40, topGirder.y).setFrame(0);
            this.createPauline(level, miniGirder);
            const frames = this.cache.json.get('girder-changes').frames;
            this.applyGirderFrame(frames.length - 1, level, topGirder, miniGirder);
            this.createLevelDetails();
            this.dropSteelBarrel();
        }

    }

    jumpOntoGirder(level, ladder) {
        const topGirder = level.platforms.find(platform =>
            platform.y + level.tileSize === ladder.y);
        const miniGirder = level.platforms.reduce((highest, platform) =>
            platform.y < highest.y ? platform : highest);
        const startX = this.kong.x;
        const startY = this.kong.y;
        // Jump straight up and land with Kong's feet on the girder.
        const landingY = topGirder.y;

        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 900,
            ease: 'Linear',
            onUpdate: tween => {
                const progress = tween.getValue();
                this.kong.setPosition(
                    startX,
                    startY + (landingY - startY) * progress - 48 * 4 * progress * (1 - progress)
                );
            },
            onComplete: () => {
                this.kong.setPosition(startX, landingY);
                this.kong.anims.stop();
                this.kong.setFrame(0);
                // Removing the black backings reveals the complete girders below.
                this.ladderObjects = this.ladderObjects.filter(entry => {
                    if (entry.ladder.y < ladder.y) return true;
                    entry.objects.forEach(object => object.destroy());
                    return false;
                });
                this.createPauline(level, miniGirder);
                this.applyGirderFrame(0, level, topGirder, miniGirder);
                // The jump onto the girder is hop 1 and already applies frame 0.
                this.hopLeft(level, topGirder, miniGirder, 1);
            }
        });
    }

    createPauline(level, miniGirder) {
        this.pauline = this.add.sprite(
            miniGirder.x + miniGirder.tiles * level.tileSize / 4,
            miniGirder.y,
            'pauline', 0
        ).setOrigin(0.5, 1);
        this.level.add(this.pauline);
        this.paulineHelp = this.add.sprite(0, 0, 'help', 0)
            .setOrigin(0, 1).setVisible(false);
        this.level.add(this.paulineHelp);
        this.paulineGirder = miniGirder;
        const paulineTexture = this.textures.get('pauline');
        if (!paulineTexture.has('heart')) paulineTexture.add('heart', 0, 110, 9, 15, 13);
        if (!paulineTexture.has('broken-heart')) paulineTexture.add('broken-heart', 0, 127, 9, 16, 13);
        this.heart = this.add.image(0, 0, 'pauline', 'heart').setVisible(false);
        this.level.add(this.heart);
        this.level.bringToTop(this.kong);
    }

    applyGirderFrame(frameIndex, level, topGirder, miniGirder) {
        const frame = this.cache.json.get('girder-changes').frames[frameIndex];
        this.platformTiles.forEach((tiles, row) => {
            tiles.forEach((tile, column) => { tile.y = frame[row][column]; });
        });
        this.kong.y = this.girderHeightAt(this.kong.x, level, topGirder);
        this.pauline.y = this.girderHeightAt(this.pauline.x, level, miniGirder);
    }

    girderHeightAt(x, level, platform) {
        const column = Phaser.Math.Clamp(
            Math.floor((x - platform.x) / level.tileSize), 0, platform.tiles - 1
        );
        return this.platformTiles[level.platforms.indexOf(platform)][column].y;
    }

    hopLeft(level, topGirder, miniGirder, hopIndex = 1) {
        if (hopIndex === 6) {
            this.createLevelDetails();
            this.kong.once('animationcomplete-kong-laugh', () => {
                this.kong.setFrame(0);
                this.events.once('wake', () => {
                    this.marioMovementLocked = false;
                    this.dropSteelBarrel();
                });
                this.scene.launch('IntermissionScene');
                this.scene.sleep();
            });
            // The initial cycle plus two repeats makes three laughs.
            this.kong.play({ key: 'kong-laugh', repeat: 2 });
            return;
        }

        const startX = this.kong.x;
        const startY = this.kong.y;
        const landingX = startX + (topGirder.x + 40 - startX) / (6 - hopIndex);
        const landingY = this.girderHeightAt(landingX, level, topGirder);
        this.tweens.addCounter({
            from: 0,
            to: 1,
            delay: 120,
            duration: 420,
            ease: 'Linear',
            onUpdate: tween => {
                const progress = tween.getValue();
                this.kong.setPosition(
                    startX + (landingX - startX) * progress,
                    startY + (landingY - startY) * progress - 16 * 4 * progress * (1 - progress)
                );
            },
            onComplete: () => {
                this.kong.setPosition(landingX, landingY);
                this.applyGirderFrame(hopIndex, level, topGirder, miniGirder);
                this.hopLeft(level, topGirder, miniGirder, hopIndex + 1);
            }
        });
    }

    dropSteelBarrel() {
        const releaseBarrel = (animation, frame) => {
            if (animation.key !== 'kong-drop' || frame.textureFrame !== 5) return;
            this.kong.off('animationupdate', releaseBarrel);

            // The visible barrel ends at pixel 14 within each 18-pixel frame.
            const barrel = this.add.sprite(this.kong.x, this.kong.y - 4,
                'barrels', 11).setOrigin(0.5, 14 / 18);
            barrel.play('steel-barrel-roll-sideways');
            this.level.add(barrel);
            this.steelBarrel = barrel;
            this.trackBarrel(barrel);

            const level = this.cache.json.get('level-1');
            const landings = level.platforms
                .filter(platform => barrel.x >= platform.x &&
                    barrel.x < platform.x + platform.tiles * level.tileSize)
                .map(platform => this.girderHeightAt(barrel.x, level, platform))
                .filter(y => y >= barrel.y)
                .sort((a, b) => a - b);

            const fallToPlatform = index => {
                if (!barrel.active) return;
                if (index >= landings.length) return;
                barrel.anims.resume();
                const distance = landings[index] - barrel.y;
                this.tweens.add({
                    targets: barrel,
                    y: landings[index],
                    duration: Math.sqrt(2 * distance / 280) * 1000,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        barrel.anims.pause();
                        if (index + 1 < landings.length) {
                            this.time.delayedCall(180, () => fallToPlatform(index + 1));
                        } else {
                            this.rollSteelBarrelToOil(barrel);
                        }
                    }
                });
            };
            fallToPlatform(0);
        };
        this.kong.on('animationupdate', releaseBarrel);
        this.kong.once('animationcomplete-kong-drop', () => {
            this.kong.off('animationupdate', releaseBarrel);
            this.kong.setFrame(0);
        });
        this.kong.play('kong-drop');
    }

    rollSteelBarrelToOil(barrel) {
        const level = this.cache.json.get('level-1');
        const bottomGirder = level.platforms[level.platforms.length - 1];
        // Rolling frames have a 10-pixel-wide visible barrel, centered in the cell.
        const contactX = this.oilBarrel.x + this.oilBarrel.width + 5;
        barrel.play('steel-barrel-roll-left');
        this.tweens.add({
            targets: barrel,
            x: Math.min(barrel.x, contactX),
            duration: Math.max(0, barrel.x - contactX) / 24 * 1000,
            ease: 'Linear',
            onUpdate: () => {
                barrel.y = this.girderHeightAt(barrel.x, level, bottomGirder);
            },
            onComplete: () => {
                barrel.destroy();
                this.steelBarrel = null;
                this.oilFlame.setVisible(true).play('oil-flame');
                this.fireHunters = new FireHunters(this, { initialSpawnDelay: 1500 });
                this.startBarrelThrows();
            }
        });
    }

    startBarrelThrows() {
        if (this.barrelThrowTimer) return;
        const throwBarrel = () => {
            const release = (animation, frame) => {
                if (animation.key !== 'kong-throw-right' || frame.textureFrame !== 6) return;
                this.kong.off('animationupdate', release);
                const level = this.cache.json.get('level-1');
                const row = level.platforms.findIndex(platform =>
                    platform.x <= this.kong.x &&
                    this.kong.x < platform.x + platform.tiles * level.tileSize &&
                    Math.abs(this.girderHeightAt(this.kong.x, level, platform) - this.kong.y) < 1);
                const x = this.kong.x + 24;
                const steel = Math.random() < 0.15;
                const barrel = this.add.sprite(x,
                    this.girderHeightAt(x, level, level.platforms[row]), 'barrels', steel ? 7 : 0)
                    .setOrigin(0.5, 14 / 18);
                this.level.add(barrel);
                this.trackBarrel(barrel);
                this.rollBarrel(barrel, row, 1, steel ? 'steel-barrel' : 'barrel');
            };
            this.kong.on('animationupdate', release);
            this.kong.once('animationcomplete-kong-throw-right', () => {
                this.kong.off('animationupdate', release);
                this.kong.setFrame(0);
            });
            this.kong.play('kong-throw-right');
            this.barrelThrowTimer = this.time.delayedCall(1000 + Math.random() * 2000, throwBarrel);
        };
        throwBarrel();
        this.schedulePaulineYell();
    }

    schedulePaulineYell() {
        this.paulineYellTimer = this.time.delayedCall(4000 + Math.random() * 5000, () => {
            if (!this.pauline?.active || this.marioMovementLocked) return;
            this.pauline.once('animationcomplete-pauline-yelling', () => {
                this.pauline.setFrame(0);
                this.schedulePaulineYell();
            });
            this.pauline.play('pauline-yelling');
        });
    }

    rollBarrel(barrel, row, direction, animationPrefix) {
        if (!barrel.active) return;
        const level = this.cache.json.get('level-1');
        const platform = level.platforms[row];
        const nextPlatform = level.platforms[row + 1];
        const ladders = this.cache.json.get('level-1-details').ladders
            .filter(ladder => {
                const x = ladder.x + level.tileSize / 2;
                if (!nextPlatform || (x - barrel.x) * direction <= 0 ||
                    x < platform.x || x >= platform.x + platform.tiles * level.tileSize ||
                    x < nextPlatform.x || x >= nextPlatform.x + nextPlatform.tiles * level.tileSize) return false;
                const top = Math.min(...ladder.segments.map(([y]) => y));
                const bottom = Math.max(...ladder.segments.map(([y, height]) => y + height));
                return Math.abs(top - this.girderHeightAt(x, level, platform) - level.tileSize) <= 2 &&
                    Math.abs(bottom - this.girderHeightAt(x, level, nextPlatform)) <= 2;
            })
            .map(ladder => ladder.x + level.tileSize / 2)
            .sort((a, b) => (a - b) * direction);
        const edge = direction > 0 ? platform.x + platform.tiles * level.tileSize + 5 : platform.x - 5;
        const waypoints = [...ladders, edge];
        barrel.play(`${animationPrefix}-roll-${direction > 0 ? 'right' : 'left'}`);
        const rollTo = index => {
            this.tweens.add({
                targets: barrel,
                x: waypoints[index],
                duration: Math.abs(waypoints[index] - barrel.x) / 40 * 1000,
                ease: 'Linear',
                onUpdate: () => { barrel.y = this.girderHeightAt(barrel.x, level, platform); },
                onComplete: () => {
                    const atEdge = index === waypoints.length - 1;
                    if (!atEdge && Math.random() >= 0.35) {
                        rollTo(index + 1);
                        return;
                    }
                    if (!atEdge) barrel.play(`${animationPrefix}-roll-sideways`);
                    const landingY = nextPlatform ?
                        this.girderHeightAt(barrel.x, level, nextPlatform) : level.height + 18;
                    this.tweens.add({
                        targets: barrel,
                        y: landingY,
                        duration: Math.sqrt(2 * Math.max(0, landingY - barrel.y) / 280) * 1000,
                        ease: 'Quad.easeIn',
                        onComplete: () => {
                            if (nextPlatform) this.rollBarrel(barrel, row + 1, -direction, animationPrefix);
                            else barrel.destroy();
                        }
                    });
                }
            });
        };
        rollTo(0);
    }

    trackBarrel(barrel) {
        this.barrels.add(barrel);
        barrel.once('destroy', () => this.barrels.delete(barrel));
    }

    pickUpHammer() {
        if (this.heldHammer || !this.marioPhysics.isJumping) return;
        const pickup = this.hammers.find(hammer => hammer.active &&
            this.mario.x + 5 >= hammer.x && this.mario.x - 5 <= hammer.x + hammer.width &&
            this.mario.y >= hammer.y && this.mario.y - 16 <= hammer.y + hammer.height);
        if (!pickup) return;
        pickup.destroy();
        this.heldHammer = this.add.sprite(this.mario.x, this.mario.y, 'hammer', 0);
        this.level.add(this.heldHammer);
        this.hammerTimer = this.time.delayedCall(8000, () => {
            this.heldHammer.destroy();
            this.heldHammer = null;
            this.hammerTimer = null;
            this.mario.play('mario-idle');
        });
    }

    updateHammer() {
        if (!this.heldHammer) return;
        const direction = this.mario.flipX ? -1 : 1;
        const horizontal = Number(this.mario.frame.name) >= 15;
        // Grip positions in the hammer cells: upright (9,17), sideways (2,11).
        const gripX = horizontal ? 2 : 9;
        const gripY = horizontal ? 11 : 17;
        const handX = this.mario.x + direction * (horizontal ? 6 : -1);
        const handY = this.mario.y - (horizontal ? 7 : 15);
        this.heldHammer.setFrame(horizontal ? 1 : 0)
            .setFlipX(this.mario.flipX)
            .setOrigin((direction < 0 ? 18 - gripX : gripX) / 18, gripY / 18)
            .setPosition(handX, handY);
        const headX = handX + (horizontal ? direction * 9 : 0);
        const headY = handY - (horizontal ? 0 : 6);
        for (const barrel of this.barrels) {
            if (!barrel.active || Math.abs(barrel.x - headX) > 10 ||
                Math.abs(barrel.y - 5 - headY) > 10) continue;
            const { x, y } = barrel;
            this.tweens.killTweensOf(barrel);
            barrel.destroy();
            if (this.steelBarrel === barrel) this.steelBarrel = null;
            const effect = this.add.sprite(x, y - 5, 'hammer', 4);
            this.level.add(effect);
            effect.once('animationcomplete-barrel-destroy', () => effect.destroy());
            effect.play('barrel-destroy');
        }
    }

    updateBarrelJumpScore() {
        if (!this.marioPhysics.isJumping) {
            this.jumpScoredBarrels.clear();
            return;
        }
        for (const barrel of this.barrels) {
            const clearance = barrel.y - this.mario.y;
            if (!barrel.active || this.jumpScoredBarrels.has(barrel) ||
                Math.abs(this.mario.x - barrel.x) > 5 || clearance < 10 || clearance > 30) continue;
            this.jumpScoredBarrels.add(barrel);
            // The second barrel brings this jump's total from 100 to 300.
            const points = this.jumpScoredBarrels.size === 2 ? 200 : 100;
            const score = this.hud.values.score + points;
            this.hud.setValues({ score, highScore: Math.max(score, this.hud.values.highScore) });
        }
    }

    update(time, delta) {
        if (this.paulineHelp && this.pauline) {
            const yelling = this.pauline.anims.isPlaying &&
                this.pauline.anims.currentAnim?.key === 'pauline-yelling';
            this.paulineHelp.setVisible(yelling);
            this.paulineHelp.setPosition(this.pauline.x + 10, this.pauline.y - 16);
        }
        if (!this.mario || !this.marioPhysics || this.marioMovementLocked) return;

        const direction = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const position = this.marioPhysics.update(delta, direction,
            !this.heldHammer && this.cursors.up.isDown,
            !this.heldHammer && this.cursors.down.isDown,
            Phaser.Input.Keyboard.JustDown(this.cursors.space));
        this.mario.setPosition(position.x, position.y);
        this.fireHunters?.update(delta);
        this.pickUpHammer();
        if (this.heldHammer) {
            if (direction !== 0) this.mario.setFlipX(direction < 0);
            this.mario.play('mario-hammer', true);
            this.mario.anims.resume();
            this.updateHammer();
        } else if (this.marioPhysics.climbing) {
            this.mario.setFlipX(false);
            if (this.mario.anims.currentAnim?.key !== 'mario-climb') {
                this.mario.play('mario-climb');
            }
            if (this.marioPhysics.climbMoving) this.mario.anims.resume();
            else this.mario.anims.pause();
        } else if (!this.marioPhysics.grounded) {
            if (direction !== 0) this.mario.setFlipX(direction < 0);
            this.mario.play('mario-jump', true);
        } else if (direction !== 0) {
            this.mario.setFlipX(direction < 0);
            this.mario.play('mario-run', true);
        } else {
            this.mario.play('mario-idle', true);
        }
        showLadderTransition(this.mario, this.marioPhysics);
        if (this.checkEnemyCollision()) return;
        this.updateBarrelJumpScore();
        this.updateHeart();
    }

    checkEnemyCollision() {
        if (GODMODE || this.marioDying || this.endingStarted) return false;
        const overlaps = (enemy, halfWidth, height) => enemy.active &&
            Math.abs(this.mario.x - enemy.x) < 5 + halfWidth &&
            this.mario.y > enemy.y - height && this.mario.y - 16 < enemy.y;
        const hitBarrel = [...this.barrels].some(barrel => overlaps(barrel, 5, 10));
        const hitFire = this.fireHunters?.hunters.some(hunter => overlaps(hunter.sprite, 6, 14));
        if (!hitBarrel && !hitFire) return false;
        this.marioDying = true;
        this.marioMovementLocked = true;
        this.lives = Math.max(0, this.lives - 1);
        this.hud.setValues({ lives: this.lives });
        this.marioPhysics.body.setLinearVelocity(planck.Vec2(0, 0));
        this.time.removeAllEvents();
        this.tweens.pauseAll();
        this.heldHammer?.destroy();
        this.heldHammer = null;
        const enemies = [...this.barrels, ...(this.fireHunters?.hunters.map(hunter => hunter.sprite) ?? [])];
        for (const sprite of [this.kong, this.pauline, this.oilFlame, ...enemies]) {
            sprite?.anims.pause();
        }
        this.paulineHelp?.setVisible(false);
        this.mario.once('animationcomplete-mario-dies', () => {
            if (this.lives > 0) {
                this.scene.restart({ lives: this.lives, hudValues: { ...this.hud.values }, skipIntro: true });
            } else {
                this.scene.start('SplashScene');
            }
        });
        this.mario.play('mario-dies');
        this.mario.anims.resume();
        return true;
    }

    updateHeart() {
        if (!this.heart || !this.paulineGirder) return;
        const level = this.cache.json.get('level-1');
        const platform = this.paulineGirder;
        const onGirder = this.marioPhysics.grounded &&
            this.mario.x >= platform.x &&
            this.mario.x < platform.x + platform.tiles * level.tileSize &&
            Math.abs(this.mario.y - this.girderHeightAt(this.mario.x, level, platform)) < 2;
        this.heart.setVisible(onGirder);
        if (onGirder) {
            this.marioMovementLocked = true;
            this.marioPhysics.body.setLinearVelocity(planck.Vec2(0, 0));
            this.mario.anims.stop();
            this.mario.setFrame(0).setFlipX(true);
            this.heart.setPosition((this.mario.x + this.pauline.x) / 2,
                Math.min(this.mario.y, this.pauline.y) - 18);
            this.startEnding();
        }
    }

    startEnding() {
        if (this.endingStarted) return;
        this.endingStarted = true;
        this.barrelThrowTimer?.remove();
        this.paulineYellTimer?.remove();
        this.hammerTimer?.remove();
        this.heldHammer?.destroy();
        this.heldHammer = null;
        this.fireHunters?.destroy();
        this.fireHunters = null;
        for (const barrel of this.barrels) {
            this.tweens.killTweensOf(barrel);
            barrel.destroy();
        }
        this.steelBarrel = null;
        this.pauline.removeAllListeners('animationcomplete-pauline-yelling');
        this.pauline.anims.stop();
        this.pauline.setFrame(0);
        this.paulineHelp.setVisible(false);
        this.kong.removeAllListeners('animationupdate');
        this.kong.removeAllListeners('animationcomplete-kong-throw-right');
        this.kong.anims.stop();
        this.kong.setFlipX(false).setFrame(6);
        this.level.bringToTop(this.kong);

        const level = this.cache.json.get('level-1');
        const ladders = level.ladders.filter(ladder => ladder.x < this.paulineGirder.x &&
            ladder.y < this.paulineGirder.y);
        const climbX = ladders.reduce((sum, ladder) => sum + ladder.x + level.tileSize / 2, 0) / ladders.length;
        const climbBottom = Math.max(...ladders.map(ladder => ladder.y + ladder.height));
        const climbTop = Math.min(...ladders.map(ladder => ladder.y));
        this.time.delayedCall(600, () => {
            this.kong.setPosition(climbX, climbBottom);
            // Geometry masks use world coordinates, outside the scaled level container.
            const maskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
            const updateExitMask = () => {
                maskGraphics.clear().fillStyle(0xffffff).fillRect(
                    this.level.x,
                    this.level.y + climbTop * this.level.scaleY,
                    level.width * this.level.scaleX,
                    (level.height - climbTop) * this.level.scaleY
                );
            };
            updateExitMask();
            const exitMask = maskGraphics.createGeometryMask();
            this.kong.setMask(exitMask);
            this.scale.on('resize', updateExitMask);
            const clearExitMask = () => {
                this.scale.off('resize', updateExitMask);
                this.kong.clearMask();
                exitMask.destroy();
                maskGraphics.destroy();
            };
            this.events.once('shutdown', clearExitMask);
            this.kong.play('kong-climb');
            let carryingPauline = false;
            this.tweens.add({
                targets: this.kong,
                y: climbTop,
                duration: (climbBottom - climbTop) / 30 * 1000,
                ease: 'Linear',
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
                    this.events.off('shutdown', clearExitMask);
                    clearExitMask();
                    this.heart.setFrame('broken-heart');
                    this.time.delayedCall(1200, () => {
                        this.scene.launch('IntermissionScene', {
                            height: 50, resumeGame: false, hudValues: { ...this.hud.values }
                        });
                        this.scene.sleep();
                    });
                }
            });
        });
    }

    createLevelDetails() {
        if (this.levelDetails) return;
        const details = this.cache.json.get('level-1-details');
        this.levelDetails = this.add.container(0, 0);
        this.level.add(this.levelDetails);

        for (const ladder of details.ladders) {
            for (const [y, height] of ladder.segments) {
                for (let offset = 0; offset < height; offset += 8) {
                    const tile = this.add.image(ladder.x, y + offset, 'game-tiles', 'ladder-cyan')
                        .setOrigin(0);
                    const visibleHeight = Math.min(8, height - offset);
                    if (visibleHeight < 8) tile.setCrop(0, 0, 8, visibleHeight);
                    this.levelDetails.add(tile);
                }
            }
        }

        // Use the reference's prop artwork at native resolution.
        const props = this.textures.get('level-1-props');
        if (!props.has('hammer')) props.add('hammer', 0, 17, 98, 9, 10);
        const randomSprites = this.textures.get('random-sprites');
        if (!randomSprites.has('oil-drum')) randomSprites.add('oil-drum', 0, 127, 0, 16, 17);
        if (!props.has('barrel-stack')) props.add('barrel-stack', 0, 0, 51, 20, 32);
        this.barrelStack = this.add.image(details.barrelStack.x, details.barrelStack.y,
            'level-1-props', 'barrel-stack').setOrigin(0);
        this.levelDetails.add(this.barrelStack);
        this.hammers = details.hammers.map(({ x, y }) => {
            const hammer = this.add.image(x, y, 'level-1-props', 'hammer').setOrigin(0);
            this.levelDetails.add(hammer);
            return hammer;
        });
        this.oilBarrel = this.add.image(details.oilBarrel.x, details.oilBarrel.y + 7,
            'random-sprites', 'oil-drum').setOrigin(0);
        this.levelDetails.add(this.oilBarrel);
        if (!this.anims.exists('oil-flame')) {
            this.anims.create({
                key: 'oil-flame',
                frames: this.anims.generateFrameNumbers('fire', { start: 8, end: 11 }),
                frameRate: 8,
                repeat: -1
            });
        }
        this.oilFlame = this.add.sprite(this.oilBarrel.x + this.oilBarrel.width / 2,
            this.oilBarrel.y + 2, 'fire', 8).setOrigin(0.5, 1).setVisible(false);
        this.levelDetails.add(this.oilFlame);

        const level = this.cache.json.get('level-1');
        const bottomGirder = level.platforms[level.platforms.length - 1];
        const spawnX = this.oilBarrel.x + this.oilBarrel.width + 16;
        const spawnY = this.girderHeightAt(spawnX, level, bottomGirder);
        this.mario = this.add.sprite(spawnX, spawnY, 'mario', 0).setOrigin(0.5, 1);
        this.level.add(this.mario);
        createMarioAnimations(this.anims);
        if (!this.anims.exists('barrel-destroy')) {
            this.anims.create({
                key: 'barrel-destroy',
                frames: this.anims.generateFrameNumbers('hammer', { start: 4, end: 7 }),
                frameRate: 10,
                repeat: 0
            });
        }
        this.mario.play('mario-idle');
        const ladders = details.ladders.concat(this.ladderObjects.map(({ ladder }) => ({
            x: ladder.x, segments: [[ladder.y, ladder.height]]
        })));
        this.marioPhysics = new MarioPhysics(this.platformTiles, level.tileSize, spawnX, spawnY, ladders);
    }
}
