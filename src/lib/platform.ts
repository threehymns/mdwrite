import { Capacitor } from "@capacitor/core";

export type Platform = "web" | "electron" | "ios" | "android";

export function getPlatform(): Platform {
	if (typeof window !== "undefined") {
		const mdwrite = (window as any).mdwrite;
		if (mdwrite?.electron) return "electron";
	}

	if (Capacitor.isNativePlatform()) {
		return Capacitor.getPlatform() as "ios" | "android";
	}

	return "web";
}

export function isMobile(): boolean {
	const platform = getPlatform();
	return platform === "ios" || platform === "android";
}

export function isNative(): boolean {
	return Capacitor.isNativePlatform();
}

export function supportsFileSystemAccessAPI(): boolean {
	if (typeof window === "undefined") return false;
	return "showDirectoryPicker" in window;
}
