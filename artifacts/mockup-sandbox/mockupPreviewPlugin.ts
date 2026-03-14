// ============================================================================
// MOCKUP PREVIEW PLUGIN - Dynamic Component Discovery for Replit
// ============================================================================
// This Vite plugin automatically discovers mockup components and generates
// an import registry that App.tsx uses for dynamic previews.
//
// WHAT IT DOES:
// 1. Scans src/components/mockups/**/*.tsx for component files
// 2. Generates src/.generated/mockup-components.ts with import() wrappers
// 3. Watches for file add/remove and regenerates on changes
// 4. Auto-rescans on 404s to catch race conditions
//
// WHY IT EXISTS:
// Replit's canvas/preview system needs to dynamically load components by path.
// Instead of manually maintaining a component registry, this plugin auto-generates
// it by scanning the filesystem.
//
// NAMING CONVENTION:
// - Files/folders starting with "_" are excluded from preview
// - Example: src/components/mockups/fleet-command/FleetCommand.tsx is included
// - Example: src/components/mockups/_internal/Helper.tsx is excluded
//
// GENERATED OUTPUT EXAMPLE:
// export const modules = {
//   "./components/mockups/fleet-command/FleetCommand.tsx": () => import("..."),
//   ...
// };
// ============================================================================

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import glob from "fast-glob";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import type { Plugin } from "vite";

// Directory to scan for mockup components
const MOCKUPS_DIR = "src/components/mockups";

// Output file for generated import registry
const GENERATED_MODULE = "src/.generated/mockup-components.ts";

console.log("[mockupPreviewPlugin] Plugin initialized with config:", {
  mockupsDir: MOCKUPS_DIR,
  generatedModule: GENERATED_MODULE,
});

// Discovered component metadata
interface DiscoveredComponent {
  globKey: string;     // Key used in the registry (e.g. "./components/mockups/foo/Bar.tsx")
  importPath: string;  // Relative import path from the generated file
}

// ============================================================================
// PLUGIN FACTORY
// ============================================================================
export function mockupPreviewPlugin(): Plugin {
  console.log("[mockupPreviewPlugin] Creating plugin instance");
  
  // Plugin state (initialized during Vite lifecycle hooks)
  let root = "";                        // Vite project root (set in configResolved)
  let currentSource = "";               // Last generated module source (for change detection)
  let watcher: FSWatcher | null = null; // File watcher instance (set in configureServer)

  // ─── Path Helpers ───────────────────────────────────────────────────────────
  // These build absolute paths for the mockups directory and generated file
  
  function getMockupsAbsDir(): string {
    return path.join(root, MOCKUPS_DIR);
  }

  function getGeneratedModuleAbsPath(): string {
    return path.join(root, GENERATED_MODULE);
  }

  // ─── File Classification ────────────────────────────────────────────────────
  
  // Check if a file is inside the mockups directory and is a .tsx file
  // Returns false for files outside mockups dir or non-.tsx files
  function isMockupFile(absolutePath: string): boolean {
    const rel = path.relative(getMockupsAbsDir(), absolutePath);
    const result = (
      !rel.startsWith("..") && !path.isAbsolute(rel) && rel.endsWith(".tsx")
    );
    console.log("[mockupPreviewPlugin.isMockupFile]", absolutePath, "->", result);
    return result;
  }

  // Check if a mockup file should be included in preview registry
  // Excludes files/folders starting with "_" (internal/private convention)
  // Example: "foo/Bar.tsx" -> true, "_internal/Helper.tsx" -> false
  function isPreviewTarget(relativeToMockups: string): boolean {
    const segments = relativeToMockups.split(path.sep);
    const result = segments.every((segment) => !segment.startsWith("_"));
    console.log("[mockupPreviewPlugin.isPreviewTarget]", relativeToMockups, "->", result);
    return result;
  }

  // ─── Component Discovery ────────────────────────────────────────────────────
  // Scans the mockups directory and returns metadata for all eligible components
  // Uses fast-glob to find .tsx files, excluding anything starting with "_"
  async function discoverComponents(): Promise<Array<DiscoveredComponent>> {
    console.log("[mockupPreviewPlugin.discoverComponents] Starting component discovery");
    console.log("[mockupPreviewPlugin.discoverComponents] Scanning pattern:", `${MOCKUPS_DIR}/**/*.tsx`);
    console.log("[mockupPreviewPlugin.discoverComponents] Root directory:", root);
    
    const files = await glob(`${MOCKUPS_DIR}/**/*.tsx`, {
      cwd: root,
      ignore: ["**/_*/**", "**/_*.tsx"], // Exclude files/folders starting with "_"
    });

    console.log("[mockupPreviewPlugin.discoverComponents] Found files:", files.length);
    console.log("[mockupPreviewPlugin.discoverComponents] File list:", files);

    // Map file paths to registry entries
    // globKey: what App.tsx looks up (e.g. "./components/mockups/foo/Bar.tsx")
    // importPath: relative import from .generated/ to the file
    const components = files.map((f) => ({
      globKey: "./" + f.slice("src/".length),
      importPath: path.posix.relative("src/.generated", f),
    }));
    
    console.log("[mockupPreviewPlugin.discoverComponents] Discovered components:", components);
    return components;
  }

  // ─── Code Generation ────────────────────────────────────────────────────────
  // Generates the TypeScript source for the import registry module
  // Output: src/.generated/mockup-components.ts
  function generateSource(components: Array<DiscoveredComponent>): string {
    console.log("[mockupPreviewPlugin.generateSource] Generating module source for", components.length, "components");
    
    // Build the import entries
    // Example entry: "./components/mockups/foo/Bar.tsx": () => import("../components/mockups/foo/Bar.tsx")
    const entries = components
      .map(
        (c) =>
          `  ${JSON.stringify(c.globKey)}: () => import(${JSON.stringify(c.importPath)})`,
      )
      .join(",\n");

    const source = [
      "// This file is auto-generated by mockupPreviewPlugin.ts.",
      "// DO NOT EDIT MANUALLY - changes will be overwritten.",
      "type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;",
      "export const modules: ModuleMap = {",
      entries,
      "};",
      "",
    ].join("\n");
    
    console.log("[mockupPreviewPlugin.generateSource] Generated source length:", source.length, "characters");
    return source;
  }

  // ─── Auto-Rescan Decision ───────────────────────────────────────────────────
  // Determines if a 404 request should trigger a rescan
  // Used by middleware to handle race conditions where a new mockup file exists
  // but the registry hasn't been regenerated yet
  function shouldAutoRescan(pathname: string): boolean {
    const shouldRescan = (
      pathname.includes("/components/mockups/") ||
      pathname.includes("/.generated/mockup-components")
    );
    console.log("[mockupPreviewPlugin.shouldAutoRescan]", pathname, "->", shouldRescan);
    return shouldRescan;
  }

  // ─── Refresh Queue ──────────────────────────────────────────────────────────
  // Prevents concurrent refresh operations and queues follow-ups
  let refreshInFlight = false;  // True while a refresh is running
  let refreshQueued = false;    // True if a refresh was requested during another refresh

  // ─── Registry Refresh ───────────────────────────────────────────────────────
  // Core function: discovers components, generates source, writes file
  // Returns true if the generated file changed (triggers HMR), false otherwise
  //
  // CONCURRENCY HANDLING:
  // - If a refresh is already running, queue another refresh instead of blocking
  // - After the in-flight refresh completes, run the queued refresh
  // - This ensures no file-add events are missed during slow discovery
  async function refresh(): Promise<boolean> {
    console.log("[mockupPreviewPlugin.refresh] Refresh requested");
    
    if (refreshInFlight) {
      console.log("[mockupPreviewPlugin.refresh] Refresh already in flight, queuing follow-up");
      refreshQueued = true;
      return false;
    }

    console.log("[mockupPreviewPlugin.refresh] Starting refresh");
    refreshInFlight = true;
    let changed = false;
    
    try {
      // Step 1: Discover all eligible components
      const components = await discoverComponents();
      console.log("[mockupPreviewPlugin.refresh] Discovery complete:", components.length, "components");
      
      // Step 2: Generate the TypeScript source
      const newSource = generateSource(components);
      
      // Step 3: Compare with previous source
      if (newSource !== currentSource) {
        console.log("[mockupPreviewPlugin.refresh] Source changed, writing to disk");
        currentSource = newSource;
        const generatedModuleAbsPath = getGeneratedModuleAbsPath();
        
        // Ensure output directory exists
        mkdirSync(path.dirname(generatedModuleAbsPath), { recursive: true });
        
        // Write the new registry
        writeFileSync(generatedModuleAbsPath, currentSource);
        console.log("[mockupPreviewPlugin.refresh] ✓ Registry written to:", generatedModuleAbsPath);
        changed = true;
      } else {
        console.log("[mockupPreviewPlugin.refresh] Source unchanged, skipping write");
      }
    } catch (error) {
      console.error("[mockupPreviewPlugin.refresh] ✗ Refresh failed:", error);
      throw error;
    } finally {
      refreshInFlight = false;
    }

    // If another refresh was queued while this one ran, execute it now
    if (refreshQueued) {
      console.log("[mockupPreviewPlugin.refresh] Processing queued refresh");
      refreshQueued = false;
      const followUp = await refresh();
      return changed || followUp;
    }

    console.log("[mockupPreviewPlugin.refresh] Refresh complete, changed:", changed);
    return changed;
  }

  // ─── File Watcher Callbacks ─────────────────────────────────────────────────
  // Triggered when mockup files are added or removed
  async function onFileAddedOrRemoved(): Promise<void> {
    console.log("[mockupPreviewPlugin.onFileAddedOrRemoved] File system change detected, triggering refresh");
    await refresh();
  }

  // ─── Vite Plugin Interface ──────────────────────────────────────────────────
  // Implements the Vite plugin lifecycle hooks
  return {
    name: "mockup-preview",
    enforce: "pre", // Run before other plugins
    
    // HOOK: Called when Vite config is fully resolved
    // This is where we capture the project root path
    configResolved(config) {
      root = config.root;
      console.log("[mockupPreviewPlugin.configResolved] Vite root set to:", root);
      console.log("[mockupPreviewPlugin.configResolved] Absolute mockups dir:", getMockupsAbsDir());
      console.log("[mockupPreviewPlugin.configResolved] Absolute generated module:", getGeneratedModuleAbsPath());
    },

    // HOOK: Called at the start of every build
    // Initial registry generation happens here
    async buildStart() {
      console.log("[mockupPreviewPlugin.buildStart] Build starting, running initial component discovery");
      await refresh();
    },

    // HOOK: Called when dev server starts
    // Sets up file watching and 404-based auto-rescan middleware
    async configureServer(viteServer) {
      console.log("[mockupPreviewPlugin.configureServer] Configuring dev server");
      
      // Initial registry generation for dev mode
      console.log("[mockupPreviewPlugin.configureServer] Running initial refresh");
      await refresh();

      // Ensure mockups directory exists
      const mockupsAbsDir = getMockupsAbsDir();
      console.log("[mockupPreviewPlugin.configureServer] Ensuring mockups dir exists:", mockupsAbsDir);
      mkdirSync(mockupsAbsDir, { recursive: true });

      // Set up file watcher
      // awaitWriteFinish prevents triggering on partial writes
      console.log("[mockupPreviewPlugin.configureServer] Starting file watcher");
      watcher = chokidar.watch(mockupsAbsDir, {
        ignoreInitial: true, // Don't trigger on existing files at startup
        awaitWriteFinish: {
          stabilityThreshold: 100, // Wait 100ms after last change
          pollInterval: 50,        // Check every 50ms
        },
      });

      // Watch for new files
      watcher.on("add", (file) => {
        console.log("[mockupPreviewPlugin.watcher.add] File added:", file);
        if (
          isMockupFile(file) &&
          isPreviewTarget(path.relative(mockupsAbsDir, file))
        ) {
          console.log("[mockupPreviewPlugin.watcher.add] File is a valid preview target, triggering refresh");
          void onFileAddedOrRemoved();
        } else {
          console.log("[mockupPreviewPlugin.watcher.add] File ignored (not a preview target)");
        }
      });

      // Watch for deleted files
      watcher.on("unlink", (file) => {
        console.log("[mockupPreviewPlugin.watcher.unlink] File removed:", file);
        if (isMockupFile(file)) {
          console.log("[mockupPreviewPlugin.watcher.unlink] File was a mockup, triggering refresh");
          void onFileAddedOrRemoved();
        } else {
          console.log("[mockupPreviewPlugin.watcher.unlink] File ignored (not a mockup)");
        }
      });

      // MIDDLEWARE: Auto-rescan on 404
      // WHY: Race condition where a component exists but registry hasn't updated yet
      // HOW: Intercept res.end(), check status code, trigger refresh if 404 on mockup path
      console.log("[mockupPreviewPlugin.configureServer] Installing 404 auto-rescan middleware");
      viteServer.middlewares.use((req, res, next) => {
        const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
        const pathname = requestUrl.pathname;
        const originalEnd = res.end.bind(res);

        // Wrap res.end() to inspect status code after response completes
        res.end = ((...args: Parameters<typeof originalEnd>) => {
          if (res.statusCode === 404 && shouldAutoRescan(pathname)) {
            console.log("[mockupPreviewPlugin.middleware] 404 on mockup path, triggering auto-rescan:", pathname);
            void refresh();
          }
          return originalEnd(...args);
        }) as typeof res.end;

        next();
      });
      
      console.log("[mockupPreviewPlugin.configureServer] Dev server configuration complete");
    },

    // HOOK: Called when Vite server shuts down
    // Clean up the file watcher
    async closeWatcher() {
      if (watcher) {
        console.log("[mockupPreviewPlugin.closeWatcher] Closing file watcher");
        await watcher.close();
      }
    },
  };
}
