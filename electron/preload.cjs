const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("mdwrite", {
	platform: process.platform,
	electron: process.versions.electron,
	chrome: process.versions.chrome,
	node: process.versions.node,
});

