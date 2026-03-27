import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.mdwrite.app",
	appName: "MDWrite",
	webDir: "dist",
	server: {
		androidScheme: "https",
	},
	plugins: {
		Filesystem: {
			androidScheme: "https",
		},
	},
};

export default config;
