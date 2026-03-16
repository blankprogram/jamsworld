import minecraftIcon from "../../assets/Icons/minecraft.png";
import ExternalAppFrame from "../../components/ExternalAppFrame/ExternalAppFrame";
import { createAppManifest } from "../createAppManifest";

export const appManifest = createAppManifest({
  id: "minecraft",
  title: "Minecraft",
  icon: minecraftIcon,
});

function Minecraft({ isFocused }) {
  return (
    <ExternalAppFrame
      src="https://minecraft-threejs.netlify.app/"
      title="sim"
      isFocused={isFocused}
    />
  );
}

export default Minecraft;
