import {
	ArrowLeft01Icon,
	ComputerIcon,
	KeyboardIcon,
	MoonIcon,
	RotateIcon,
	SunIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { type Theme, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useKeyboardShortcuts } from "@/lib/shortcuts";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function ShortcutRecorder({
	initialKeys,
	onSave,
}: {
	initialKeys: string[];
	onSave: (keys: string[]) => void;
}) {
	const [isRecording, setIsRecording] = React.useState(false);
	const [keys, setKeys] = React.useState<string[]>(initialKeys);

	const handleKeyDown = React.useCallback(
		(e: KeyboardEvent) => {
			if (!isRecording) return;
			e.preventDefault();

			const newKeys: string[] = [];
			if (e.ctrlKey || e.metaKey) newKeys.push("ctrl");
			if (e.shiftKey) newKeys.push("shift");
			if (e.altKey) newKeys.push("alt");

			const key = e.key.toLowerCase();
			if (!["control", "shift", "alt", "meta"].includes(key)) {
				newKeys.push(key);
				setKeys(newKeys);
				onSave(newKeys);
				setIsRecording(false);
			}
		},
		[isRecording, onSave],
	);

	React.useEffect(() => {
		if (isRecording) {
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}
	}, [isRecording, handleKeyDown]);

	return (
		<Button
			variant={isRecording ? "destructive" : "outline"}
			size="sm"
			onClick={() => setIsRecording(!isRecording)}
			className="h-7 min-w-24 gap-1 px-2 text-xs"
		>
			{isRecording ? (
				"Recording..."
			) : (
				<div className="flex items-center gap-1">
					{keys.map((key) => (
						<kbd
							key={key}
							className="rounded bg-muted px-1 py-0.5 font-sans text-[10px] text-muted-foreground uppercase"
						>
							{key}
						</kbd>
					))}
				</div>
			)}
		</Button>
	);
}

function SettingsPage() {
	const { theme, setTheme, fontSize, setFontSize } = useTheme();
	const { shortcuts, updateShortcut, resetShortcuts } = useKeyboardShortcuts();

	return (
		<div className="min-h-screen bg-background p-8 text-foreground">
			<div className="mx-auto max-w-2xl space-y-8">
				<div className="flex items-center gap-4">
					<Link to="/">
						<Button variant="ghost" size="icon" type="button">
							<HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" />
						</Button>
					</Link>
					<h1 className="font-bold text-3xl tracking-tight">Settings</h1>
				</div>

				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Appearance</CardTitle>
							<CardDescription>
								Customize how MDWrite looks on your screen.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label>Theme</Label>
									<p className="text-muted-foreground text-sm">
										Select your preferred color theme.
									</p>
								</div>
								<Select
									value={theme}
									onValueChange={(v) => v && setTheme(v as Theme)}
								>
									<SelectTrigger className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem value="light">
												<div className="flex items-center gap-2">
													<HugeiconsIcon icon={SunIcon} className="h-4 w-4" />
													<span>Light</span>
												</div>
											</SelectItem>
											<SelectItem value="dark">
												<div className="flex items-center gap-2">
													<HugeiconsIcon icon={MoonIcon} className="h-4 w-4" />
													<span>Dark</span>
												</div>
											</SelectItem>
											<SelectItem value="system">
												<div className="flex items-center gap-2">
													<HugeiconsIcon
														icon={ComputerIcon}
														className="h-4 w-4"
													/>
													<span>System</span>
												</div>
											</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>

							<Separator />

							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label>Font Size</Label>
									<p className="text-muted-foreground text-sm">
										Adjust the editor font size.
									</p>
								</div>
								<Select
									value={fontSize}
									onValueChange={(v) => v && setFontSize(v)}
								>
									<SelectTrigger className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{["12", "14", "16", "18", "20", "24"].map((size) => (
												<SelectItem key={size} value={size}>
													{size}px
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0">
							<div className="space-y-1.5">
								<CardTitle className="flex items-center gap-2">
									<HugeiconsIcon icon={KeyboardIcon} className="h-5 w-5" />
									Keyboard Shortcuts
								</CardTitle>
								<CardDescription>
									Configure custom hotkeys for common actions.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={resetShortcuts}
								className="h-8 gap-2"
							>
								<HugeiconsIcon icon={RotateIcon} className="h-3.5 w-3.5" />
								Reset
							</Button>
						</CardHeader>
						<CardContent className="space-y-4">
							{[
								{ id: "new-file", label: "New File" },
								{ id: "search", label: "Search Content" },
								{ id: "command-bar", label: "Command Bar" },
								{ id: "toggle-sidebar", label: "Toggle Sidebar" },
								{ id: "open-folder", label: "Open Folder" },
							].map((action) => (
								<div
									key={action.id}
									className="flex items-center justify-between"
								>
									<Label>{action.label}</Label>
									<ShortcutRecorder
										initialKeys={shortcuts[action.id] || []}
										onSave={(keys) => updateShortcut(action.id, keys)}
									/>
								</div>
							))}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>About</CardTitle>
							<CardDescription>MDWrite v0.1.0</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								MDWrite is a clean, privacy-focused markdown editor that works
								directly with your local files.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
