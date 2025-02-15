import React, { useEffect, useRef } from 'react';
import clippy from 'clippyts';

function Clippy( {appName}) {
  const agentRef = useRef(null);

  useEffect(() => {
    

    clippy.load({
        name: 'Clippy',
        selector: 'my-clippy',
          successCb: (agent) => {
            agentRef.current = agent;
            console.log("Loaded!");
            agent.show();
          agent.speak("Welcome to the DEMO!");
          agent.animate();
        },
        failCb: (e) => {
            console.error(e)
        }
      })
  }, []);

  useEffect(() => {
    if (agentRef.current && appName) {
        console.log(appName)
      agentRef.current.speak(`You are now focusing on ${appName}.`);
    }
  }, [appName]);
  return (
<div></div>
  );
}

export default Clippy;
