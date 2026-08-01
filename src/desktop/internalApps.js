import { createAppManifest } from "../applications/createAppManifest";
import noFileIcon from "../assets/Icons/nofile.png";
import SystemConfirmDialog from "../components/SystemConfirmDialog/SystemConfirmDialog";

const SYSTEM_CONFIRM_DIALOG = {
  ...createAppManifest({
    id: "system-confirm-dialog",
    title: "Confirm",
    icon: noFileIcon,
    windowDefaults: {
      width: 460,
      height: 150,
      minWidth: 440,
      minHeight: 140,
      resizable: false,
    },
  }),
  component: SystemConfirmDialog,
  showInTaskbar: false,
};

export const INTERNAL_APP_REGISTRY = Object.freeze([SYSTEM_CONFIRM_DIALOG]);

export const INTERNAL_APPS_BY_ID = INTERNAL_APP_REGISTRY.reduce((lookup, app) => {
  lookup[app.id] = app;
  return lookup;
}, {});
