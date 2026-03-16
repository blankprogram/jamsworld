import circIcon from "../../assets/Icons/circ.png";
import ExternalAppFrame from "../../components/ExternalAppFrame/ExternalAppFrame";
import { createAppManifest } from "../createAppManifest";

export const appManifest = createAppManifest({
  id: "circfinity",
  title: "CircFinity",
  icon: circIcon,
});

function Circfinity({ isFocused }) {
  return (
    <ExternalAppFrame
      src="https://blankprogram.github.io/circfinity/"
      title="circfinity"
      isFocused={isFocused}
    />
  );
}

export default Circfinity;
