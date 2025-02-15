import clippy from 'clippyts';
import React, { useEffect, useRef } from 'react';
import introText from './intro';

/**
 * Plays a short "blip" note using the Web Audio API.
 * @param {AudioContext} audioCtx - The audio context to use.
 */
const playDialogueNote = (audioCtx) => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (audioCtx.state === 'closed') return; // Safeguard

  const oscillator = audioCtx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(200 + Math.random() * 200, audioCtx.currentTime);

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  // Stop after 70ms to create a quick "blip"
  oscillator.stop(audioCtx.currentTime + 0.07);
};

function Clippy({ appName }) {
  const agentRef = useRef(null);
  const idleIntervalRef = useRef(null);
  const didInit = useRef(false);
  const audioCtxRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // Initialize AudioContext (may be suspended initially)
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();

    // Resume AudioContext on any user click
    const resumeAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener('click', resumeAudio);

    clippy.load({
      name: 'Clippy',
      selector: 'my-clippy',
      successCb: (agent) => {
        agentRef.current = agent;
        agent.show();

        // Monkey-patch balloon.speak to attach a new MutationObserver
        // that plays a beep each time the text is updated.
        const originalBalloonSpeak = agent._balloon.speak.bind(agent._balloon);
        agent._balloon.speak = (complete, text, hold) => {
          if (agent._balloon && agent._balloon._content) {
            const targetNode = agent._balloon._content;
            observerRef.current = new MutationObserver((mutationsList) => {
              mutationsList.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                  playDialogueNote(audioCtxRef.current);
                }
              });
            });
            observerRef.current.observe(targetNode, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          }

          originalBalloonSpeak(() => {
            complete();
            // Disconnect observer when speech is finished.
            if (observerRef.current) {
              observerRef.current.disconnect();
              observerRef.current = null;
            }
          }, text, hold);
        };

        // Trigger an idle animation every 10 seconds.
        idleIntervalRef.current = setInterval(() => {
          if (agentRef.current) {
            agentRef.current.animate();
          }
        }, 10000);

        // Speak each line from introText with a delay.
        const lines = introText.split('\n').filter((line) => line.trim() !== '');
        let delay = 0;
        lines.forEach((line) => {
          setTimeout(() => {
            agent.speak(line);
          }, delay);
          delay += 4000;
        });
      },
      failCb: (e) => {
        console.error(e);
      },
    });

    // Cleanup: clear intervals and remove event listeners.
    return () => {
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      window.removeEventListener('click', resumeAudio);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return <div className="my-clippy" style={{ position: 'absolute' }}></div>;
}

export default Clippy;
