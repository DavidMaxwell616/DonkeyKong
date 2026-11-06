import GameScene from './GameScene.js';
import SplashScene from './Splashscene.js';
import IntermissionScene from './IntermissionScene.js';
import Level2Scene from './Level2Scene.js';
import Level3Scene from './Level3Scene.js';
import Level4Scene from './Level4Scene.js';

const config = {
    type: Phaser.WEBGL,
    parent: 'game',
    width: 800,
    height: 500,
    backgroundColor: '#000000',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [SplashScene, GameScene, IntermissionScene, Level2Scene, Level3Scene, Level4Scene]
};

new Phaser.Game(config);
