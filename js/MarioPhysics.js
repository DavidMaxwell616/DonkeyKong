const PIXELS_PER_METER = 16;
const STEP = 1 / 60;

export default class MarioPhysics {
    constructor(platformTiles, tileSize, x, feetY, ladders = [], surfaceVelocity = () => 0, obstacles = []) {
        const { World, Vec2, Box, Circle } = planck;
        this.world = new World(Vec2(0, 30));
        this.accumulator = 0;
        this.halfHeight = 8;
        this.climb = null;
        this.climbing = false;
        this.climbMoving = false;
        this.jumpSpeedMultiplier = 1;
        this.isJumping = false;
        this.surfaceVelocity = surfaceVelocity;
        this.ladders = ladders.flatMap(ladder => ladder.segments.map(([top, height]) => {
            const centerX = ladder.x + tileSize / 2;
            const floors = platformTiles.map((row, index) => ({
                index, tile: row.find(tile => centerX >= tile.x && centerX < tile.x + tileSize)
            })).filter(floor => floor.tile);
            const lower = floors.find(floor => Math.abs(floor.tile.y - (top + height)) <= 2);
            const upper = floors.find(floor => Math.abs(floor.tile.y + tileSize - top) <= 2);
            return {
                x: centerX, bottom: lower ? lower.tile.y - 0.3 : top + height,
                top: upper ? upper.tile.y - 0.3 : top,
                platform: upper?.index,
                lowerPlatform: lower?.index,
                isClimbable: ladder.isClimbable ?? (() => true)
            };
        })).filter(ladder => ladder.lowerPlatform !== undefined || ladder.platform !== undefined);
        const meters = value => value / PIXELS_PER_METER;

        for (const row of platformTiles) {
            for (const tile of row) {
                const floor = this.world.createBody({
                    position: Vec2(meters(tile.x + tileSize / 2), meters(tile.y + tileSize / 2))
                });
                floor.createFixture(Box(meters(tileSize / 2), meters(tileSize / 2)), {
                    friction: 0,
                    restitution: 0,
                    userData: { platformTop: tile.y }
                });
            }
        }

        // Solid scenery blocks all sides; it does not use one-way platform contacts.
        for (const obstacle of obstacles) {
            const body = this.world.createBody({
                position: Vec2(meters(obstacle.x + obstacle.width / 2),
                    meters(obstacle.y + obstacle.height / 2))
            });
            body.createFixture(Box(meters(obstacle.width / 2), meters(obstacle.height / 2)), {
                friction: 0, restitution: 0
            });
        }

        this.body = this.world.createDynamicBody({
            position: Vec2(meters(x), meters(feetY - this.halfHeight)),
            fixedRotation: true,
            bullet: true
        });
        const material = { density: 1, friction: 0, restitution: 0 };
        this.body.createFixture(Box(meters(4), meters(4)), material);
        this.body.createFixture(Circle(Vec2(0, meters(4)), meters(4)), material);
        this.body.createFixture(Circle(Vec2(0, meters(-4)), meters(4)), material);
        this.previousFeetY = feetY;
        this.world.on('pre-solve', contact => {
            const fixtureA = contact.getFixtureA();
            const fixtureB = contact.getFixtureB();
            const platform = fixtureA.getBody() === this.body ? fixtureB :
                fixtureB.getBody() === this.body ? fixtureA : null;
            const top = platform?.getUserData()?.platformTop;
            if (top === undefined) return;
            // Ignore undersides and upward travel; allow a small tolerance for girder steps.
            if (this.body.getLinearVelocity().y < 0 || this.previousFeetY > top + 2) {
                contact.setEnabled(false);
            }
        });
    }

    get grounded() {
        if (this.climb || this.body.getLinearVelocity().y < -0.1) return false;
        for (let edge = this.body.getContactList(); edge; edge = edge.next) {
            const contact = edge.contact;
            if (!contact.isTouching() || !contact.isEnabled()) continue;
            const normal = contact.getWorldManifold(null).normal;
            const marioIsA = contact.getFixtureA().getBody() === this.body;
            if ((marioIsA ? normal.y : -normal.y) > 0.5) return true;
        }
        return false;
    }

    update(delta, direction, up = false, down = false, jump = false) {
        const jumping = jump && this.grounded;
        if (jumping) {
            this.isJumping = true;
            this.jumpSpeedMultiplier = direction !== 0 ? 2 : 1;
            const velocity = this.body.getLinearVelocity();
            this.body.setLinearVelocity(planck.Vec2(velocity.x, -7));
        }
        const vertical = Number(down) - Number(up);
        const feet = this.body.getPosition();
        if (!jumping && !this.climb && vertical !== 0 && direction === 0) {
            const ladder = this.ladders.find(ladder =>
                ladder.isClimbable() &&
                Math.abs(feet.x * PIXELS_PER_METER - ladder.x) <= 4 &&
                (vertical < 0 ? ladder.lowerPlatform !== undefined : ladder.platform !== undefined) &&
                Math.abs(feet.y * PIXELS_PER_METER + this.halfHeight -
                    (vertical < 0 ? ladder.bottom : ladder.top)) <= 2);
            if (ladder) {
                this.climb = ladder;
                this.body.setType('kinematic');
                this.body.setPosition(planck.Vec2(ladder.x / PIXELS_PER_METER, feet.y));
            }
        }
        if (this.climb && (direction !== 0 || !this.climb.isClimbable())) {
            this.climb = null;
            this.body.setType('dynamic');
            this.body.setLinearVelocity(planck.Vec2(0, 0));
        }
        const feetY = this.body.getPosition().y * PIXELS_PER_METER + this.halfHeight;
        this.climbMoving = Boolean(this.climb && (vertical < 0
            ? feetY > this.climb.top + 0.01
            : vertical > 0 && feetY < this.climb.bottom - 0.01));
        // Limit catch-up after a paused tab; step independently of rendering FPS.
        this.accumulator += Math.min(delta / 1000, 0.1);
        while (this.accumulator + 1e-9 >= STEP) {
            const velocity = this.body.getLinearVelocity();
            if (this.climb) {
                const y = this.body.getPosition().y * PIXELS_PER_METER + this.halfHeight;
                const remaining = vertical < 0 ? y - this.climb.top : this.climb.bottom - y;
                const speed = vertical !== 0 ? Math.min(32, Math.max(0, remaining) / STEP) : 0;
                this.climbMoving = speed > 0;
                this.body.setLinearVelocity(planck.Vec2(0, vertical * speed / PIXELS_PER_METER));
            } else {
                const grounded = this.grounded;
                if (grounded) this.jumpSpeedMultiplier = 1;
                const position = this.body.getPosition();
                const beltSpeed = grounded ? this.surfaceVelocity(position.x * PIXELS_PER_METER,
                    position.y * PIXELS_PER_METER + this.halfHeight) : 0;
                this.body.setLinearVelocity(planck.Vec2(
                    (direction * 60 * this.jumpSpeedMultiplier + beltSpeed) / PIXELS_PER_METER, velocity.y));
            }
            this.previousFeetY = this.body.getPosition().y * PIXELS_PER_METER + this.halfHeight;
            this.world.step(STEP);
            const y = this.body.getPosition().y * PIXELS_PER_METER + this.halfHeight;
            const reachedTop = this.climb && vertical < 0 && this.climb.platform !== undefined &&
                y <= this.climb.top + 0.01;
            const reachedBottom = this.climb && vertical > 0 && this.climb.lowerPlatform !== undefined &&
                y >= this.climb.bottom - 0.01;
            if (reachedTop || reachedBottom) {
                this.girderLevel = reachedTop ? this.climb.platform : this.climb.lowerPlatform;
                this.climb = null;
                this.body.setType('dynamic');
                this.body.setLinearVelocity(planck.Vec2(0, 0));
            }
            this.accumulator -= STEP;
        }
        const position = this.body.getPosition();
        this.climbing = this.climb !== null;
        if (this.climbing || this.grounded) this.isJumping = false;
        return {
            x: position.x * PIXELS_PER_METER,
            y: position.y * PIXELS_PER_METER + this.halfHeight
        };
    }
}
