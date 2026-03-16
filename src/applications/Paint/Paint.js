import paintIcon from "../../assets/Icons/paint.png";
import ExternalAppFrame from "../../components/ExternalAppFrame/ExternalAppFrame";
import { createAppManifest } from "../createAppManifest";

export const appManifest = createAppManifest({
  id: "paint",
  title: "Paint",
  icon: paintIcon,
});

function Paint({ isFocused }) {
  return (
    <ExternalAppFrame
      src="https://jspaint.app"
      title="paint"
      isFocused={isFocused}
    />
  );
}

export default Paint;
