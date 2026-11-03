export default class FireHunters {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.hunters = [];
        this.level = options.level ?? scene.cache.json.get('level-1');
        this.heightAt = options.heightAt ?? ((x, platform) => scene.girderHeightAt(x, this.level, platform));
        this.spawnTarget = options.spawnTarget;
        this.maxHunters = options.maxHunters ?? Infinity;
        this.ladders = scene.marioPhysics.ladders.filter(ladder =>
            ladder.platform !== undefined && ladder.lowerPlatform !== undefined);
        if (!scene.anims.exists('fire-hunter')) {
            scene.anims.create({
                key: 'fire-hunter',
                frames: scene.anims.generateFrameNumbers('fire', { start: 0, end: 1 }),
                frameRate: 8,
                repeat: -1
            });
        }
        this.scheduleSpawn();
    }

    scheduleSpawn() {
        this.spawnTimer = this.scene.time.delayedCall(5000 + Math.random() * 4000, () => {
            if (this.scene.oilFlame.visible && !this.scene.marioMovementLocked &&
                this.hunters.filter(hunter => hunter.sprite.active).length < this.maxHunters) {
                this.spawn();
            }
            this.scheduleSpawn();
        });
    }

    spawn() {
        const scene = this.scene;
        const target = this.spawnTarget?.();
        const row = target?.row ?? this.level.platforms.length - 1;
        const startX = scene.oilBarrel.x + scene.oilBarrel.width / 2;
        const startY = scene.oilBarrel.y;
        const endX = target?.x ?? startX + 26;
        const endY = this.heightAt(endX, this.level.platforms[row]);
        const sprite = scene.add.sprite(startX, startY, 'fire', 0)
            .setOrigin(0.5, 1).play('fire-hunter');
        scene.level.add(sprite);
        const hunter = { sprite, row, hopping: true, climb: null };
        this.hunters.push(hunter);
        hunter.hopTween = scene.tweens.addCounter({
            from: 0, to: 1, duration: 700,
            onUpdate: tween => {
                const t = tween.getValue();
                sprite.setPosition(startX + (endX - startX) * t,
                    startY + (endY - startY) * t - 24 * 4 * t * (1 - t));
            },
            onComplete: () => { hunter.hopping = false; }
        });
    }

    destroy() {
        this.spawnTimer?.remove();
        for (const hunter of this.hunters) {
            hunter.hopTween?.stop();
            hunter.sprite.destroy();
        }
        this.hunters = [];
    }

    nextLadder(row, targetRow, x) {
        // Breadth-first search finds a route through intact ladders, including Pauline's girder.
        const queue = [{ row, first: null }];
        const visited = new Set([row]);
        const ladders = [...this.ladders].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
        for (let i = 0; i < queue.length; i++) {
            const current = queue[i];
            if (current.row === targetRow) return current.first;
            for (const ladder of ladders) {
                if (ladder.isClimbable && !ladder.isClimbable()) continue;
                const next = ladder.platform === current.row ? ladder.lowerPlatform :
                    ladder.lowerPlatform === current.row ? ladder.platform : undefined;
                if (next === undefined || visited.has(next)) continue;
                visited.add(next);
                queue.push({ row: next, first: current.first || { ladder, row: next } });
            }
        }
        return null;
    }

    update(delta) {
        const scene = this.scene;
        const step = Math.min(delta / 1000, 0.1);
        const moveToward = (from, to, distance) => from + Math.sign(to - from) * Math.min(Math.abs(to - from), distance);
        const targetRow = this.level.platforms.reduce((best, platform, row) => {
            if (scene.mario.x < platform.x || scene.mario.x >= platform.x + platform.tiles * this.level.tileSize) return best;
            const distance = Math.abs(scene.mario.y - this.heightAt(scene.mario.x, platform));
            return distance < best.distance ? { row, distance } : best;
        }, { row: this.level.platforms.length - 1, distance: Infinity }).row;
        for (const hunter of this.hunters) {
            const sprite = hunter.sprite;
            if (!sprite.active || hunter.hopping) continue;
            if (hunter.climb) {
                if (hunter.climb.ladder.isClimbable && !hunter.climb.ladder.isClimbable()) continue;
                const y = this.heightAt(sprite.x, this.level.platforms[hunter.climb.row]);
                sprite.y = moveToward(sprite.y, y, 20 * step);
                if (sprite.y === y) {
                    hunter.row = hunter.climb.row;
                    hunter.climb = null;
                }
                continue;
            }
            const route = hunter.row === targetRow ? null : this.nextLadder(hunter.row, targetRow, sprite.x);
            const platform = this.level.platforms[hunter.row];
            const targetX = route ? route.ladder.x : Math.max(platform.x + 5,
                Math.min(platform.x + platform.tiles * this.level.tileSize - 5, scene.mario.x));
            sprite.setFlipX(targetX < sprite.x);
            sprite.x = moveToward(sprite.x, targetX, 26 * step);
            sprite.y = this.heightAt(sprite.x, platform);
            if (route && sprite.x === targetX) hunter.climb = route;
        }
    }
}
