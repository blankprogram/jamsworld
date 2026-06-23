import { useEffect, useRef } from "react";
import { initAgent } from "clippyjs";
import * as agents from "clippyjs/agents";
import { getBottomRightPosition } from "../../desktop/windowGeometry";
import introText from "./intro";

const playDialogueNote = (audioCtx) => {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (audioCtx.state === "closed") return;

  const oscillator = audioCtx.createOscillator();
  oscillator.type = "sine";
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

const STARTUP_ANIMATIONS = ["GetAttention", "Greeting", "Wave"];

const SAFE_IDLE_ANIMATIONS = [
  "IdleAtom",
  "IdleEyeBrowRaise",
  "IdleFingerTap",
  "IdleHeadScratch",
  "IdleRopePile",
  "IdleSideToSide",
  "IdleSnooze",
  "Idle1_1",
  "LookUp",
  "LookDown",
  "LookLeft",
  "LookRight",
  "LookUpRight",
  "Thinking",
  "CheckingSomething",
  "Searching",
  "GetTechy",
  "GetArtsy",
  "GetWizardy",
  "Writing",
  "Print",
];

const AGENT_TYPES = [
  "Clippy",
  "Bonzi",
  "F1",
  "Genie",
  "Genius",
  "Links",
  "Merlin",
  "Peedy",
  "Rocky",
  "Rover",
];

const pickAgentLoader = () => {
  const availableLoaders = AGENT_TYPES.map(
    (agentType) => agents[agentType],
  ).filter(Boolean);
  const randomIndex = Math.floor(Math.random() * availableLoaders.length);
  return availableLoaders[randomIndex] || agents.Clippy;
};

const waitForFrame = () =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const positionAgentAtBottomRight = (agent) => {
  const agentElement = agent?._el;
  if (!agentElement) return;

  const clippyWidth = agentElement.offsetWidth || 150;
  const clippyHeight = agentElement.offsetHeight || 150;
  const { x, y } = getBottomRightPosition(clippyWidth, clippyHeight);

  agentElement.style.left = `${x}px`;
  agentElement.style.top = `${y}px`;
  agent.reposition?.();
};

const showAgentImmediately = (agent) => {
  if (!agent?._el) return;
  agent._hidden = false;
  agent._el.style.display = "block";

  if (agent.hasAnimation?.("RestPose")) {
    agent._animator?.showAnimation("RestPose", () => {});
  }
};

const playFirstAvailable = (agent, animationNames) => {
  const animationName = animationNames.find((name) =>
    agent.hasAnimation?.(name),
  );
  return animationName ? agent.play(animationName) : false;
};

const playRandomAvailable = (agent, animationNames) => {
  const availableAnimations = animationNames.filter((name) =>
    agent.hasAnimation?.(name),
  );
  if (!availableAnimations.length) return false;

  const randomIndex = Math.floor(Math.random() * availableAnimations.length);
  return agent.play(availableAnimations[randomIndex]);
};

const observeDialogueText = (agent, audioCtxRef) => {
  const contentNode = agent?._balloon?._content;
  if (!contentNode || !window.MutationObserver) return null;

  let previousText = contentNode.textContent || "";
  const observer = new MutationObserver(() => {
    const nextText = contentNode.textContent || "";
    if (nextText && nextText !== previousText) {
      playDialogueNote(audioCtxRef.current);
    }
    previousText = nextText;
  });

  observer.observe(contentNode, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  return observer;
};

function Clippy() {
  const agentRef = useRef(null);
  const dialogueObserverRef = useRef(null);
  const idleIntervalRef = useRef(null);
  const introTimeoutsRef = useRef([]);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtxRef.current = new AudioContextClass();
    }

    const resumeAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };
    window.addEventListener("click", resumeAudio);

    const scheduleIntro = (agent) => {
      const lines = introText.split("\n").filter((line) => line.trim() !== "");
      let delay = 2000;

      lines.forEach((line) => {
        const timeoutId = window.setTimeout(() => {
          if (!isMounted) return;
          agent.speak(line);
        }, delay);

        introTimeoutsRef.current.push(timeoutId);
        delay += 4000;
      });

      const idleTimeoutId = window.setTimeout(() => {
        if (!isMounted) return;

        idleIntervalRef.current = window.setInterval(() => {
          playRandomAvailable(agent, SAFE_IDLE_ANIMATIONS);
        }, 10000);
      }, delay);

      introTimeoutsRef.current.push(idleTimeoutId);
    };

    const startClippy = async () => {
      try {
        const loader = pickAgentLoader();
        const agent = await initAgent({
          ...loader,
          sound: async () => ({ default: {} }),
        });
        if (!isMounted) {
          agent.dispose();
          return;
        }

        agentRef.current = agent;
        dialogueObserverRef.current = observeDialogueText(agent, audioCtxRef);

        positionAgentAtBottomRight(agent);
        showAgentImmediately(agent);
        await waitForFrame();
        if (!isMounted) return;

        positionAgentAtBottomRight(agent);
        playFirstAvailable(agent, STARTUP_ANIMATIONS);
        scheduleIntro(agent);
      } catch (e) {
        console.error(e);
      }
    };

    startClippy();

    return () => {
      isMounted = false;
      introTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      introTimeoutsRef.current = [];
      if (idleIntervalRef.current)
        window.clearInterval(idleIntervalRef.current);
      window.removeEventListener("click", resumeAudio);
      if (dialogueObserverRef.current) {
        dialogueObserverRef.current.disconnect();
        dialogueObserverRef.current = null;
      }
      if (agentRef.current) {
        agentRef.current.dispose();
        agentRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return null;
}

export default Clippy;
