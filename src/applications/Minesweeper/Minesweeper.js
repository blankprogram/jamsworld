import minesweeperIcon from "../../assets/Icons/minesweeper.png";
import ExternalAppFrame from "../../components/ExternalAppFrame/ExternalAppFrame";
import { createAppManifest } from "../createAppManifest";

export const appManifest = createAppManifest({
  id: "minesweeper",
  title: "Minesweeper",
  icon: minesweeperIcon,
});

function Minesweeper({ isFocused }) {
  return (
    <ExternalAppFrame
      src="https://mines.now.sh"
      title="paint"
      isFocused={isFocused}
    />
  );
}

export default Minesweeper;
