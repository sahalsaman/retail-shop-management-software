// Electron main process: boots the Next.js standalone server with SQLite as
// the local primary store. Cloud MongoDB is contacted on demand by the server
// for auth + background sync (see lib/sync/*). Fully offline-capable: the app
// keeps working without network, except for login.

const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const isDev = !app.isPackaged;

const DEV_URL = "http://127.0.0.1:3000";

function nextServerPath() {
  return isDev
    ? null
    : path.join(process.resourcesPath, "app", ".next", "standalone", "server.js");
}

function nextServerCwd() {
  return path.join(process.resourcesPath, "app", ".next", "standalone");
}

function userDataDir() {
  return app.getPath("userData");
}

function sqlitePath() {
  return path.join(userDataDir(), "rsms.db");
}

function logsDir() {
  return path.join(userDataDir(), "logs");
}

function ensureDirs() {
  fs.mkdirSync(logsDir(), { recursive: true });
}

// Persist a per-install JWT secret so sessions survive across launches.
function readOrCreateJwtSecret() {
  const file = path.join(userDataDir(), "jwt.secret");
  try {
    const v = fs.readFileSync(file, "utf8").trim();
    if (v) return v;
  } catch {
    /* generate */
  }
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

// Cloud config is shipped in the installer as cloud-config.json (see
// electron-builder extraResources in package.json). It holds the cloud Mongo
// URI + db name so the packaged .exe can log users in without any per-PC
// setup. Falls back to env when running under `npm run electron` in dev.
function loadCloudConfig() {
  const candidates = [
    path.join(__dirname, "..", "build", "cloud-config.json"),
    process.resourcesPath ? path.join(process.resourcesPath, "cloud-config.json") : null,
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch {
      /* try next */
    }
  }
  return {};
}

function cloudMongoUri(cfg) {
  return (
    process.env.CLOUD_MONGODB_URI ||
    cfg.CLOUD_MONGODB_URI ||
    process.env.MONGODB_URI ||
    ""
  );
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function waitForPort(port, host, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = new net.Socket();
      const done = (ok, err) => {
        s.destroy();
        if (ok) return resolve();
        if (Date.now() > deadline) return reject(err || new Error("timeout"));
        setTimeout(tryOnce, 250);
      };
      s.once("error", (e) => done(false, e));
      s.connect(port, host, () => done(true));
    };
    tryOnce();
  });
}

let nextProc = null;

function startNext(port, jwtSecret, cfg) {
  const entry = nextServerPath();
  const cwd = nextServerCwd();
  if (!entry || !fs.existsSync(entry)) {
    throw new Error(
      `Next standalone server missing at ${entry}. Did the build complete?`,
    );
  }
  nextProc = spawn(process.execPath, [entry], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      SQLITE_DB_PATH: sqlitePath(),
      CLOUD_MONGODB_URI: cloudMongoUri(cfg),
      DB_NAME: process.env.DB_NAME || cfg.DB_NAME || "rsms",
      JWT_SECRET: jwtSecret,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  nextProc.stdout.on("data", (b) => process.stdout.write(`[next] ${b}`));
  nextProc.stderr.on("data", (b) => process.stderr.write(`[next] ${b}`));
  nextProc.on("exit", (code) => {
    console.log(`[next] exited (${code})`);
    nextProc = null;
  });
}

async function boot() {
  if (isDev) return DEV_URL;
  ensureDirs();
  const cfg = loadCloudConfig();
  const port = await pickFreePort();
  startNext(port, readOrCreateJwtSecret(), cfg);
  await waitForPort(port, "127.0.0.1", 30_000);
  return `http://127.0.0.1:${port}`;
}

function shutdown() {
  if (nextProc) {
    try {
      nextProc.kill();
    } catch {
      /* ignore */
    }
    nextProc = null;
  }
}

function appIcon() {
  // In dev: repo build/icon.png. In packaged build: the same file lives next to
  // electron/main.js since electron-builder copies the build/ tree alongside.
  const candidates = [
    path.join(__dirname, "..", "build", "icon.png"),
    path.join(process.resourcesPath || "", "build", "icon.png"),
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: appIcon(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  try {
    const url = await boot();
    await win.loadURL(url);
    win.show();
  } catch (err) {
    dialog.showErrorBox("RETAILO failed to start", String(err && err.stack ? err.stack : err));
    app.quit();
  }
}

app.on("window-all-closed", () => {
  shutdown();
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", shutdown);

app.whenReady().then(createWindow);
