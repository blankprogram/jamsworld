import startIcon from "../assets/Icons/start.png";
import { createAppManifest } from "../applications/createAppManifest";

const toKebabCase = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

const loadAppModules = () => {
  // Application entry points follow the FolderName/FolderName.js convention.
  const appsContext = require.context(
    "../applications",
    true,
    /^\.\/([^/]+)\/\1\.js$/,
  );
  return appsContext.keys().map((key) => {
    const segments = key.split("/");
    const fileName = segments[segments.length - 1].replace(".js", "");
    return { fileName, module: appsContext(key) };
  });
};

export const APP_REGISTRY = loadAppModules()
  .map(({ fileName, module: loadedModule }) => {
    const component = loadedModule.default;
    if (!component) return null;

    const fallbackManifest = createAppManifest({
      id: toKebabCase(fileName),
      title: fileName,
      icon: startIcon,
    });
    const manifest =
      loadedModule.appManifest || component.appManifest || fallbackManifest;

    return {
      ...manifest,
      component,
    };
  })
  .filter(Boolean);

export const APPS_BY_ID = APP_REGISTRY.reduce((lookup, app) => {
  lookup[app.id] = app;
  return lookup;
}, {});
