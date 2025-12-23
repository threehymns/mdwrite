import * as React from "react";

export type Theme = "light" | "dark" | "system";
export type ColorTheme =
	| "default"
	| "one-dark"
	| "dracula"
	| "nord"
	| "github"
	| "catppuccin-frappe"
	| "catppuccin-mocha";

export const COLOR_THEMES: ColorTheme[] = [
	"default",
	"github",
	"one-dark",
	"dracula",
	"nord",
	"catppuccin-frappe",
	"catppuccin-mocha",
];

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	colorTheme: ColorTheme;
	setColorTheme: (theme: ColorTheme) => void;
	fontSize: string;
	setFontSize: (size: string) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(
	undefined,
);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = React.useState<Theme>(() => {
		if (typeof window !== "undefined") {
			return (localStorage.getItem("theme") as Theme) || "system";
		}
		return "system";
	});

	const [colorTheme, setColorTheme] = React.useState<ColorTheme>(() => {
		if (typeof window !== "undefined") {
			return (localStorage.getItem("color-theme") as ColorTheme) || "default";
		}
		return "default";
	});

	const [fontSize, setFontSize] = React.useState(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("fontSize") || "16";
		}
		return "16";
	});

	React.useEffect(() => {
		localStorage.setItem("theme", theme);
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");

		if (theme === "system") {
			const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
				.matches
				? "dark"
				: "light";
			root.classList.add(systemTheme);
		} else {
			root.classList.add(theme);
		}
	}, [theme]);

	React.useEffect(() => {
		localStorage.setItem("color-theme", colorTheme);
		let link = document.getElementById("color-theme-link") as HTMLLinkElement;
		if (!link) {
			link = document.createElement("link");
			link.id = "color-theme-link";
			link.rel = "stylesheet";
			document.head.appendChild(link);
		}
		link.href = `/themes/${colorTheme}.css`;
	}, [colorTheme]);

	React.useEffect(() => {
		localStorage.setItem("fontSize", fontSize);
		document.documentElement.style.setProperty(
			"--editor-font-size",
			`${fontSize}px`,
		);
	}, [fontSize]);

	return (
		<ThemeContext.Provider
			value={{
				theme,
				setTheme,
				colorTheme,
				setColorTheme,
				fontSize,
				setFontSize,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = React.useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
