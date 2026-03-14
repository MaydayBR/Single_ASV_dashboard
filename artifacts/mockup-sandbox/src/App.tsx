// ============================================================================
// APP ROUTER - Dynamic Mockup Preview System
// ============================================================================
// This is the main routing component for the Replit mockup preview artifact.
//
// ROUTING LOGIC:
// - Base route (/__mockup): Shows Gallery with usage instructions
// - Preview route (/__mockup/preview/<ComponentPath>): Dynamically loads and
//   renders the specified mockup component
//
// COMPONENT DISCOVERY:
// The mockupPreviewPlugin scans src/components/mockups/**/*.tsx and generates
// an import registry at src/.generated/mockup-components.ts. This file imports
// that registry and uses it to dynamically load preview components.
//
// RUNTIME FLOW:
// 1. App renders
// 2. getPreviewPath() checks if URL matches /preview/* pattern
// 3. If yes: PreviewRenderer dynamically imports and renders the component
// 4. If no: Gallery shows the usage instructions
// ============================================================================

import { useEffect, useState, type ComponentType } from "react";

import { modules as discoveredModules } from "./.generated/mockup-components";

console.log("[App] Component imported; discovered modules count:", Object.keys(discoveredModules).length);
console.log("[App] Available mockup keys:", Object.keys(discoveredModules));

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

// ============================================================================
// COMPONENT RESOLUTION HELPER
// ============================================================================
// Attempts to find a valid React component from a dynamically loaded module.
// 
// RESOLUTION ORDER (first match wins):
// 1. mod.default - standard default export
// 2. mod.Preview - explicit Preview export (mockup convention)
// 3. mod[name] - named export matching the component file name
// 4. Last function in the module - fallback heuristic
//
// WHY THIS IS NEEDED:
// Different mockup files may export components in different ways. This function
// provides a consistent resolution strategy so preview URLs work regardless of
// how the component was exported.
// ============================================================================
function _resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  console.log("[App._resolveComponent] Resolving component:", name);
  console.log("[App._resolveComponent] Module exports:", Object.keys(mod));
  
  const fns = Object.values(mod).filter(
    (v) => typeof v === "function",
  ) as ComponentType[];
  
  console.log("[App._resolveComponent] Found function exports:", fns.length);
  
  const resolved = (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    fns[fns.length - 1]
  );
  
  if (resolved) {
    console.log("[App._resolveComponent] ✓ Component resolved successfully");
  } else {
    console.error("[App._resolveComponent] ✗ No valid component found in module");
  }
  
  return resolved;
}

// ============================================================================
// PREVIEW RENDERER - Dynamic Component Loader
// ============================================================================
// This component handles the actual loading and rendering of mockup previews.
//
// PROPS:
// - componentPath: relative path like "fleet-command/FleetCommand"
// - modules: import registry from mockupPreviewPlugin
//
// LOAD FLOW:
// 1. Construct key: "./components/mockups/<componentPath>.tsx"
// 2. Look up loader function in the modules registry
// 3. Call loader() to dynamically import the module
// 4. Resolve which export to render using _resolveComponent()
// 5. Update state to trigger render
//
// ERROR HANDLING:
// - Missing component: registry doesn't have the requested key
// - Load failure: dynamic import throws (syntax error, missing deps, etc.)
// - No valid export: module loaded but no React component found
//
// CANCELLATION:
// If componentPath changes before the async load completes, the old load
// is marked as cancelled and won't update state.
// ============================================================================
function PreviewRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  console.log("[PreviewRenderer] Rendering preview for path:", componentPath);
  
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[PreviewRenderer.useEffect] Starting component load for:", componentPath);
    let cancelled = false;

    // Reset state for new load
    setComponent(null);
    setError(null);

    async function loadComponent(): Promise<void> {
      // Construct the registry key
      // Example: componentPath="fleet-command/FleetCommand"
      //          key="./components/mockups/fleet-command/FleetCommand.tsx"
      const key = `./components/mockups/${componentPath}.tsx`;
      console.log("[PreviewRenderer.loadComponent] Looking up registry key:", key);
      
      const loader = modules[key];
      if (!loader) {
        console.error("[PreviewRenderer.loadComponent] ✗ Component not found in registry");
        console.error("[PreviewRenderer.loadComponent] Available keys:", Object.keys(modules));
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }

      console.log("[PreviewRenderer.loadComponent] ✓ Loader found, starting dynamic import");

      try {
        // Dynamically import the module
        const mod = await loader();
        console.log("[PreviewRenderer.loadComponent] Module imported successfully");
        
        if (cancelled) {
          console.log("[PreviewRenderer.loadComponent] Load cancelled (componentPath changed)");
          return;
        }
        
        // Extract component name from path (e.g. "fleet-command/FleetCommand" -> "FleetCommand")
        const name = componentPath.split("/").pop()!;
        console.log("[PreviewRenderer.loadComponent] Extracted component name:", name);
        
        // Resolve which export to use
        const comp = _resolveComponent(mod, name);
        if (!comp) {
          console.error("[PreviewRenderer.loadComponent] ✗ No valid React component found in module");
          setError(
            `No exported React component found in ${componentPath}.tsx\n\nMake sure the file has at least one exported function component.`,
          );
          return;
        }
        
        console.log("[PreviewRenderer.loadComponent] ✓ Component resolved, updating state");
        setComponent(() => comp);
      } catch (e) {
        if (cancelled) {
          console.log("[PreviewRenderer.loadComponent] Load cancelled after error");
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        console.error("[PreviewRenderer.loadComponent] ✗ Load failed:", message);
        console.error("[PreviewRenderer.loadComponent] Full error:", e);
        setError(`Failed to load preview.\n${message}`);
      }
    }

    void loadComponent();

    return () => {
      console.log("[PreviewRenderer.useEffect cleanup] Marking load as cancelled");
      cancelled = true;
    };
  }, [componentPath, modules]);

  if (error) {
    console.log("[PreviewRenderer] Rendering error state");
    return (
      <pre style={{ color: "red", padding: "2rem", fontFamily: "system-ui" }}>
        {error}
      </pre>
    );
  }

  if (!Component) {
    console.log("[PreviewRenderer] Waiting for component to load (showing nothing)");
    return null;
  }

  console.log("[PreviewRenderer] Rendering loaded component");
  return <Component />;
}

// ============================================================================
// PATH UTILITIES
// ============================================================================
// These functions handle the BASE_PATH prefix that Replit injects.
// Why? Replit serves multiple artifacts at different URL prefixes.
// This artifact uses BASE_PATH="/__mockup", so all app URLs are under /__mockup/
// ============================================================================

// Get the base path without trailing slash
// Example: import.meta.env.BASE_URL = "/__mockup/" -> returns "/__mockup"
function getBasePath(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  console.log("[App.getBasePath] Base URL:", import.meta.env.BASE_URL, "-> base path:", base);
  return base;
}

// Generate an example preview URL for the Gallery instructions
function getPreviewExamplePath(): string {
  const basePath = getBasePath();
  const example = `${basePath}/preview/ComponentName`;
  console.log("[App.getPreviewExamplePath] Generated example:", example);
  return example;
}

// ============================================================================
// GALLERY - Default Landing Page
// ============================================================================
// Shown when accessing the base route (/__mockup)
// Provides instructions on how to access component previews
// ============================================================================
function Gallery() {
  console.log("[App.Gallery] Rendering gallery landing page");
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Component Preview Server
        </h1>
        <p className="text-gray-500 mb-4">
          This server renders individual components for the workspace canvas.
        </p>
        <p className="text-sm text-gray-400">
          Access component previews at{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {getPreviewExamplePath()}
          </code>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// PREVIEW PATH PARSER
// ============================================================================
// Extracts the component path from URLs like /__mockup/preview/ComponentName
//
// PARSING STEPS:
// 1. Get BASE_PATH (e.g. "/__mockup")
// 2. Get current pathname (e.g. "/__mockup/preview/fleet-command/FleetCommand")
// 3. Strip BASE_PATH to get local path (e.g. "/preview/fleet-command/FleetCommand")
// 4. Match against /preview/<componentPath> pattern
// 5. Return componentPath or null if no match
//
// EDGE CASES:
// - Empty pathname after stripping base: treated as "/"
// - Pathname doesn't start with base: use raw pathname (dev fallback)
// - No /preview/ segment: returns null -> Gallery renders
//
// EXAMPLE:
// URL: "/__mockup/preview/fleet-command/FleetCommand"
// -> basePath: "/__mockup"
// -> pathname: "/__mockup/preview/fleet-command/FleetCommand"
// -> local: "/preview/fleet-command/FleetCommand"
// -> match: ["preview/fleet-command/FleetCommand", "fleet-command/FleetCommand"]
// -> returns: "fleet-command/FleetCommand"
// ============================================================================
function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  
  console.log("[App.getPreviewPath] Parsing URL for preview path");
  console.log("[App.getPreviewPath] Window pathname:", pathname);
  console.log("[App.getPreviewPath] Base path:", basePath);
  
  // Strip the BASE_PATH prefix to get the local route
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  
  console.log("[App.getPreviewPath] Local path (after stripping base):", local);
  
  // Match against /preview/<componentPath> pattern
  const match = local.match(/^\/preview\/(.+)$/);
  console.log("[App.getPreviewPath] Regex match result:", match);
  
  const result = match ? match[1] : null;
  console.log("[App.getPreviewPath] Final preview path:", result);
  
  return result;
}

// ============================================================================
// ROOT APP COMPONENT
// ============================================================================
// Main routing decision point:
// - If URL contains /preview/<path>, render PreviewRenderer for that component
// - Otherwise, render Gallery (usage instructions)
// ============================================================================
function App() {
  console.log("[App] App component rendering");
  
  const previewPath = getPreviewPath();
  console.log("[App] Preview path resolved:", previewPath);

  if (previewPath) {
    console.log("[App] Routing to PreviewRenderer with path:", previewPath);
    return (
      <PreviewRenderer
        componentPath={previewPath}
        modules={discoveredModules}
      />
    );
  }

  console.log("[App] Routing to Gallery (no preview path detected)");
  return <Gallery />;
}

export default App;
