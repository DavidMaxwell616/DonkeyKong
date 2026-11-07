// Set to true to test without enemy collision deaths.
export const GODMODE = false;

// Starting level when GODMODE is enabled: 1, 2, 3, or 4.
export const GODMODE_STARTING_LEVEL = 1;

export function getStartingScene() {
    return GODMODE && [2, 3, 4].includes(GODMODE_STARTING_LEVEL)
        ? `Level${GODMODE_STARTING_LEVEL}Scene` : 'GameScene';
}
