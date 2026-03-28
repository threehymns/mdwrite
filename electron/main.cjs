const { app, BrowserWindow, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_DEV_URL = "http://localhost:3000";

function firstExistingPath(paths) {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Failed to pick a free port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function waitForHttpOk(url, timeoutMs = 15_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 150);
      });
    };

    attempt();
  });
}

async function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    backgroundColor: "#0b0b0e",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Let external links open in the user's default browser.
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(url);
        return { action: "deny" };
      }
    } catch {
      // ignore
    }
    return { action: "allow" };
  });

  if (!globalThis.__mdwrite_server__) {
    globalThis.__mdwrite_server__ = { started: false, url: null };
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL;

  // If a dev URL is provided, assume we're in dev mode.
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
    return;
  }

  // In packaged builds, prefer running the built Nitro server and loading via HTTP.
  const serverEntry = firstExistingPath([
    app.isPackaged
      ? path.join(process.resourcesPath, ".output", "server", "index.mjs")
      : null,
    path.join(app.getAppPath(), ".output", "server", "index.mjs"),
    path.join(process.cwd(), ".output", "server", "index.mjs"),
  ]);

  if (serverEntry) {
    try {
      if (!globalThis.__mdwrite_server__.started) {
        const port = await getFreePort();
        process.env.NITRO_HOST = "127.0.0.1";
        process.env.NITRO_PORT = String(port);
        const url = `http://127.0.0.1:${port}`;

        // Nitro's node-server entry starts listening as a side effect of import.
        await import(pathToFileURL(serverEntry).href);
        await waitForHttpOk(url);

        globalThis.__mdwrite_server__.started = true;
        globalThis.__mdwrite_server__.url = url;
      }

      await mainWindow.loadURL(globalThis.__mdwrite_server__.url);
      return;
    } catch (err) {
      // Fall back to whatever client build we can find.
      // eslint-disable-next-line no-console
      console.warn("[electron] Failed to start Nitro server:", err);
    }
  }

  const distIndex = firstExistingPath([
    app.isPackaged
      ? path.join(process.resourcesPath, "dist", "index.html")
      : null,
    path.join(process.cwd(), "dist", "index.html"),
    path.join(process.cwd(), "dist", "client", "index.html"),
    path.join(app.getAppPath(), "dist", "index.html"),
    path.join(app.getAppPath(), "dist", "client", "index.html"),
  ]);

  if (distIndex) {
    await mainWindow.loadFile(distIndex);
    return;
  }

  // Last resort: assume a dev server is running on the default URL.
  await mainWindow.loadURL(DEFAULT_DEV_URL);
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
