import tune from '../../../tune.json';
import type { TutorialSceneMarker } from '../../tutorial/tutorialTypes';

// Replaces the canvas-drawn "Trick: N / Phase: X" top bar (see
// ui/renderGameView.ts's renderTopBar) for the whole duration of a
// tutorial session - a row of per-scene markers (locked/current/
// completed, tappable to jump per TutorialScene.jumpToScene) plus a
// persistent Quit control, reachable at every point within a scene, not
// just between them (this task's own requirement) - never shown during
// real gameplay, since ui/renderGameView.ts only ever populates
// TutorialHudConfig.scenes/onSelectScene/onQuit from a TutorialScene
// render.
export interface TutorialTopBarProps {
  scenes: TutorialSceneMarker[];
  onSelectScene: (sceneNumber: number) => void;
  onQuit: () => void;
}

export function TutorialTopBar({ scenes, onSelectScene, onQuit }: TutorialTopBarProps): JSX.Element {
  return (
    <div
      data-ui="tutorial-top-bar"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: tune.tutorialSceneMarkerGap, pointerEvents: 'auto' }}>
        {scenes.map((scene) => {
          const tappable = scene.status !== 'locked';
          const size = tune.tutorialSceneMarkerSize;
          return (
            <button
              key={scene.sceneNumber}
              type="button"
              data-ui="tutorial-scene-marker"
              data-scene={scene.sceneNumber}
              data-status={scene.status}
              disabled={!tappable}
              onClick={() => onSelectScene(scene.sceneNumber)}
              style={{
                width: size,
                height: size,
                boxSizing: 'border-box',
                borderRadius: '50%',
                border: `1px solid ${scene.status === 'locked' ? 'rgba(150, 158, 164, 0.25)' : 'rgba(198, 160, 78, 0.6)'}`,
                background:
                  scene.status === 'completed'
                    ? 'linear-gradient(180deg, rgba(226, 188, 96, 0.85), rgba(120, 88, 30, 0.65))'
                    : scene.status === 'current'
                      ? 'rgba(198, 160, 78, 0.22)'
                      : 'rgba(20, 22, 25, 0.4)',
                color: scene.status === 'completed' ? 'rgba(20, 14, 4, 0.9)' : scene.status === 'locked' ? 'rgba(150, 158, 164, 0.4)' : 'rgba(230, 216, 180, 0.9)',
                fontFamily: "'Cormorant Unicase', serif",
                fontWeight: 700,
                fontSize: Math.round(size * 0.42),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: tappable ? 'pointer' : 'default',
                padding: 0,
              }}
            >
              {scene.status === 'completed' ? '✓' : scene.sceneNumber}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        data-ui="tutorial-quit-button"
        onClick={onQuit}
        style={{
          pointerEvents: 'auto',
          padding: '6px 12px',
          background: 'rgba(20, 22, 25, 0.55)',
          border: '1px solid rgba(158, 196, 186, 0.35)',
          borderRadius: 4,
          color: 'rgba(200, 214, 210, 0.85)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.14em',
          cursor: 'pointer',
        }}
      >
        Quit
      </button>
    </div>
  );
}
