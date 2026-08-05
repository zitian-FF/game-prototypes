import Phaser from 'phaser';

class HelloScene extends Phaser.Scene {
  create(): void {
    const box = this.add.rectangle(80, 300, 60, 60, 0x4fd1c5);

    this.tweens.add({
      targets: box,
      x: 720,
      duration: 1500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    this.add.text(16, 16, `build ${__GIT_SHA__}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 800,
  height: 600,
  backgroundColor: '#111111',
  scene: HelloScene,
});
