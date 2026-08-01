import folderIcon from "../assets/Icons/Folder.png";
import noFileIcon from "../assets/Icons/nofile.png";
import notepadIcon from "../assets/Icons/notepad.png";

export const getFileSystemNodeIcon = (node, appsById = {}) => {
  if (node?.type === "shortcut" && node.appId) {
    return appsById[node.appId]?.icon || folderIcon;
  }
  if (node?.type === "folder") return folderIcon;
  if (node?.type === "markdown" || node?.type === "text") return notepadIcon;
  return noFileIcon;
};
