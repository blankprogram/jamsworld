import { createAppManifest } from "../applications/createAppManifest";
import SystemDialog from "../components/SystemDialog/SystemDialog";
import FileBrowserDialog from "../components/FileBrowserDialog/FileBrowserDialog";

const SYSTEM_DIALOG = {
  ...createAppManifest({
    id: "system-dialog",
    title: "Confirm",
    icon: null,
    windowDefaults: {
      width: 460,
      height: 150,
      minWidth: 440,
      minHeight: 140,
      resizable: false,
    },
  }),
  component: SystemDialog,
  showInTaskbar: false,
};

const FILE_BROWSER_DIALOG = {
  ...createAppManifest({
    id: "file-browser-dialog",
    title: "Save As",
    icon: null,
    windowDefaults: {
      width: 560,
      height: 360,
      minWidth: 500,
      minHeight: 300,
      resizable: false,
    },
  }),
  component: FileBrowserDialog,
  showInTaskbar: false,
};

export const INTERNAL_APP_REGISTRY = Object.freeze([
  SYSTEM_DIALOG,
  FILE_BROWSER_DIALOG,
]);

export const INTERNAL_APPS_BY_ID = INTERNAL_APP_REGISTRY.reduce((lookup, app) => {
  lookup[app.id] = app;
  return lookup;
}, {});
