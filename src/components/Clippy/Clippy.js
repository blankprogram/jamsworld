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

    audioCtxRef.current = new window.AudioContext();

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

        const taskbarHeight = 30;
        const clippyWidth = 150;
        const clippyHeight = 150;
        
        const x = window.innerWidth - clippyWidth;
        const y = window.innerHeight - taskbarHeight - clippyHeight;
        
        agent.moveTo(x, y, 0);
        

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
            if (observerRef.current) {
              observerRef.current.disconnect();
              observerRef.current = null;
            }
          }, text, hold);
        };

        idleIntervalRef.current = setInterval(() => {
          if (agentRef.current) {
            agentRef.current.animate();
          }
        }, 10000);

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

    return () => {
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      window.removeEventListener('click', resumeAudio);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return (
    <div
      className="my-clippy"
      style={{
        zIndex:1000
      }}
    ></div>
  );
}

export default Clippy;
