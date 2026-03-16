import sandIcon from "../../assets/Icons/sand.png";
import ExternalAppFrame from "../../components/ExternalAppFrame/ExternalAppFrame";
import { createAppManifest } from "../createAppManifest";

export const appManifest = createAppManifest({
  id: "elementsim",
  title: "ElementSim",
  icon: sandIcon,
});

function ElementSim({ isFocused }) {
  return (
    <ExternalAppFrame
      src="https://blankprogram.github.io/elementsim/"
      title="sim"
      isFocused={isFocused}
    />
  );
}

export default ElementSim;
