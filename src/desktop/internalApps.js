import { createAppManifest } from "../applications/createAppManifest";
import noFileIcon from "../assets/Icons/nofile.png";
import SystemConfirmDialog from "../components/SystemConfirmDialog/SystemConfirmDialog";

const SYSTEM_CONFIRM_DIALOG = {
  ...createAppManifest({
    id: "system-confirm-dialog",
    title: "Confirm",
    icon: noFileIcon,
    windowDefaults: {
      width: 360,
      height: 180,
      minWidth: 340,
      minHeight: 170,
      resizable: false,
    },
  }),
  component: SystemConfirmDialog,
  showOnDesktop: false,
  showInTaskbar: false,
};

export const INTERNAL_APP_REGISTRY = Object.freeze([SYSTEM_CONFIRM_DIALOG]);

export const INTERNAL_APPS_BY_ID = INTERNAL_APP_REGISTRY.reduce((lookup, app) => {
  lookup[app.id] = app;
  return lookup;
}, {});
