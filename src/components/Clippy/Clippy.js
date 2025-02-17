import clippy from 'clippyts';
import React, { useEffect, useRef } from 'react';
import introText from './intro';


const playDialogueNote = (audioCtx) => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (audioCtx.state === 'closed') return;

  const oscillator = audioCtx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 200 + Math.random() * 200;

  const gainNode = audioCtx.createGain();
  const now = audioCtx.currentTime;
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.05, now + 0.005);
  gainNode.gain.linearRampToValueAtTime(0, now + 0.14);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.2);
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

    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();

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

        agent.play('GetAttention');

        const lines = introText.split('\n').filter((line) => line.trim() !== '');
        let delay = 2000;
        lines.forEach((line) => {
          setTimeout(() => {
            agent.speak(line);
          }, delay);
          delay += 4000;
        });

        agent.play('LookUpRight');

        setTimeout(() => {
          idleIntervalRef.current = setInterval(() => {
            agent.animate();
          }, 10000);
        }, delay);
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

  return <div className="my-clippy" style={{ zIndex: 1000 }}></div>;
}

export default Clippy;
