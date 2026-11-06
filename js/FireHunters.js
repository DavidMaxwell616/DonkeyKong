export default class FireHunters {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.hunters = [];
        this.level = options.level ?? scene.cache.json.get('level-1');
        this.heightAt = options.heightAt ?? ((x, platform) => scene.girderHeightAt(x, this.level, platform));
        this.spawnTarget = options.spawnTarget;
        this.boundsAt = options.boundsAt ?? ((row) => {
            const platform = this.level.platforms[row];
            return { left: platform.x + 5, right: platform.x + platform.tiles * this.level.tileSize - 5 };
        });
        this.maxHunters = options.maxHunters ?? Infinity;
        this.patrolRow = options.patrolRow;
        this.patrolHunterAssigned = false;
        this.patrolReleased = false;
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
        if (options.autoSpawn !== false) this.scheduleSpawn(options.initialSpawnDelay);
    }

    spawnAt(row, x) {
        const sprite = this.scene.add.sprite(x, this.heightAt(x, this.level.platforms[row]), 'fire', 0)
            .setOrigin(0.5, 1).play('fire-hunter');
        this.scene.level.add(sprite);
        this.hunters.push({ sprite, row, hopping: false, climb: null });
    }

    scheduleSpawn(delay = 5000 + Math.random() * 4000) {
        this.spawnTimer = this.scene.time.delayedCall(delay, () => {
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
        if (this.patrolRow !== undefined && !this.patrolHunterAssigned) {
            hunter.patrol = true;
            hunter.patrolDirection = 1;
            this.patrolHunterAssigned = true;
        }
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

    nextLadder(row, targetRow, x, targetX) {
        // Breadth-first search finds a route through intact ladders, including Pauline's girder.
        const queue = [{ row, x, first: null }];
        const visited = new Set([`${row}:${x}`]);
        const ladders = [...this.ladders].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
        for (let i = 0; i < queue.length; i++) {
            const current = queue[i];
            const bounds = this.boundsAt(current.row, current.x);
            if (current.row === targetRow && (targetX === undefined ||
                (targetX >= bounds.left && targetX <= bounds.right))) return current.first;
            for (const ladder of ladders) {
                if (ladder.isClimbable && !ladder.isClimbable()) continue;
                const next = ladder.platform === current.row ? ladder.lowerPlatform :
                    ladder.lowerPlatform === current.row ? ladder.platform : undefined;
                if (next === undefined || ladder.x < bounds.left || ladder.x > bounds.right) continue;
                const key = `${next}:${ladder.x}`;
                if (visited.has(key)) continue;
                visited.add(key);
                queue.push({ row: next, x: ladder.x, first: current.first || { ladder, row: next } });
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
        if (this.patrolRow !== undefined && !this.patrolReleased) {
            const platform = this.level.platforms[this.patrolRow];
            if (scene.marioPhysics.grounded && targetRow === this.patrolRow &&
                Math.abs(scene.mario.y - this.heightAt(scene.mario.x, platform)) < 2) {
                this.patrolReleased = true;
            }
        }
        for (const hunter of this.hunters) {
            const sprite = hunter.sprite;
            if (!sprite.active || hunter.hopping) continue;
            if (hunter.climb) {
                if (hunter.climb.ladder.isClimbable && !hunter.climb.ladder.isClimbable()) {
                    // Retreat to the starting platform when a folding ladder closes.
                    const y = this.heightAt(sprite.x, this.level.platforms[hunter.row]);
                    sprite.y = moveToward(sprite.y, y, 20 * step);
                    if (sprite.y === y) hunter.climb = null;
                    continue;
                }
                const y = this.heightAt(sprite.x, this.level.platforms[hunter.climb.row]);
                sprite.y = moveToward(sprite.y, y, 20 * step);
                if (sprite.y === y) {
                    hunter.row = hunter.climb.row;
                    hunter.climb = null;
                }
                continue;
            }
            const patrolling = hunter.patrol && !this.patrolReleased;
            const destinationRow = patrolling ? this.patrolRow : targetRow;
            const bounds = this.boundsAt(hunter.row, sprite.x);
            const targetXInRow = Math.max(this.level.platforms[destinationRow].x + 5,
                Math.min(this.level.platforms[destinationRow].x + this.level.platforms[destinationRow].tiles * this.level.tileSize - 5, scene.mario.x));
            const canReach = hunter.row === destinationRow &&
                (patrolling || (targetXInRow >= bounds.left && targetXInRow <= bounds.right));
            const route = canReach ? null : this.nextLadder(hunter.row, destinationRow, sprite.x,
                patrolling ? undefined : targetXInRow);
            const platform = this.level.platforms[hunter.row];
            let targetX = route ? route.ladder.x : Math.max(platform.x + 5,
                Math.min(platform.x + platform.tiles * this.level.tileSize - 5, scene.mario.x));
            const pacing = (patrolling && hunter.row === this.patrolRow) ||
                (!canReach && !route);
            if (pacing) {
                const { left, right } = bounds;
                hunter.patrolDirection ??= 1;
                if (sprite.x >= right) hunter.patrolDirection = -1;
                else if (sprite.x <= left) hunter.patrolDirection = 1;
                targetX = hunter.patrolDirection > 0 ? right : left;
            }
            sprite.setFlipX(targetX < sprite.x);
            sprite.x = moveToward(sprite.x, targetX, (pacing ? 14 : 26) * step);
            sprite.x = Math.max(bounds.left, Math.min(bounds.right, sprite.x));
            hunter.paceTime = pacing ? ((hunter.paceTime ?? 0) + step) % 1.2 : 0;
            const hopHeight = pacing ? 4 * Math.sin(Math.PI * hunter.paceTime / 1.2) : 0;
            sprite.y = this.heightAt(sprite.x, platform) - hopHeight;
            if (route && sprite.x === targetX) hunter.climb = route;
        }
    }
}
