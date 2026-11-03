// Set to true to test without enemy collision deaths.
export const GODMODE = true;

// Starting level when GODMODE is enabled: 1 or 2.
export const GODMODE_STARTING_LEVEL = 2;

export function getStartingScene() {
    return GODMODE && GODMODE_STARTING_LEVEL === 2 ? 'Level2Scene' : 'GameScene';
}
