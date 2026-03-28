import {
	Calendar03Icon,
	Copy01Icon,
	DatabaseIcon,
	Download03Icon,
	File01Icon,
	Image01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { FileNode } from "@/lib/fs";

interface ImageTabProps {
	file: FileNode;
}

interface Metadata {
	size: string;
	type: string;
	lastModified: string;
	dimensions?: { width: number; height: number };
	exif?: Record<string, string>;
	userComment?: string;
}

export function ImageTab({ file }: ImageTabProps) {
	const [imageSrc, setImageSrc] = useState<string | null>(null);
	const [metadata, setMetadata] = useState<Metadata | null>(null);

	useEffect(() => {
		let isMounted = true;
		const handle = file.handle as FileSystemFileHandle;
		let currentUrl: string | null = null;

		const extractExif = async (blob: Blob) => {
			try {
				const buffer = await blob.arrayBuffer();
				const view = new DataView(buffer);
				if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) return {};

				const exifData: Record<string, string> = {};
				let offset = 2;

				while (offset + 4 <= view.byteLength) {
					const marker = view.getUint16(offset);
					const length = view.getUint16(offset + 2);

					if (marker === 0xffe1) {
						if (offset + 4 + 6 > view.byteLength) break;
						const identifier = view.getUint32(offset + 4);
						if (identifier === 0x45786966) {
							// "Exif\0\0"
							const start = offset + 10;
							if (start + 8 > view.byteLength) break;

							const isLittle = view.getUint16(start) === 0x4949;
							const ifd0Offset = view.getUint32(start + 4, isLittle);

							const getString = (off: number, count: number) => {
								if (start + off + count > view.byteLength) return "";
								let s = "";
								for (let i = 0; i < count; i++) {
									const char = view.getUint8(start + off + i);
									if (char === 0) break;
									s += String.fromCharCode(char);
								}
								return s.trim();
							};

							const parseIFD = (ifdOff: number) => {
								if (ifdOff === 0 || start + ifdOff + 2 > view.byteLength)
									return;
								const numEntries = view.getUint16(start + ifdOff, isLittle);

								for (let i = 0; i < numEntries; i++) {
									const entry = start + ifdOff + 2 + i * 12;
									if (entry + 12 > view.byteLength) break;

									const tag = view.getUint16(entry, isLittle);
									const count = view.getUint32(entry + 4, isLittle);
									const valOffset = view.getUint32(entry + 8, isLittle);

									if (tag === 0x010f)
										exifData.Make = getString(valOffset, count);
									if (tag === 0x0110)
										exifData.Model = getString(valOffset, count);
									if (tag === 0x0131)
										exifData.Software = getString(valOffset, count);
									if (tag === 0x8769) parseIFD(valOffset);
									if (tag === 0x8827) {
										exifData.ISO = view
											.getUint16(entry + 8, isLittle)
											.toString();
									}
									if (tag === 0x9286) {
										// UserComment - skip 8 bytes encoding prefix
										if (count > 8) {
											exifData.UserComment = getString(
												valOffset + 8,
												count - 8,
											);
										}
									}
								}
							};
							parseIFD(ifd0Offset);
						}
						break;
					}
					offset += 2 + length;
				}
				return exifData;
			} catch (_) {
				return {};
			}
		};

		handle.getFile().then(async (f) => {
			if (!isMounted) return;
			currentUrl = URL.createObjectURL(f);
			setImageSrc(currentUrl);

			const img = new Image();
			img.onload = async () => {
				if (isMounted) {
					const exif = f.type === "image/jpeg" ? await extractExif(f) : {};
					const { UserComment, ...otherExif } = exif;
					const filteredExif = Object.fromEntries(
						Object.entries(otherExif).filter(([_, v]) => v && v !== "0"),
					);

					setMetadata({
						size: `${(f.size / 1024).toFixed(2)} KB`,
						type: f.type,
						lastModified: new Date(f.lastModified).toLocaleString(),
						dimensions: { width: img.width, height: img.height },
						exif:
							Object.keys(filteredExif).length > 0 ? filteredExif : undefined,
						userComment: UserComment,
					});
				}
			};
			img.src = currentUrl;
		});

		return () => {
			isMounted = false;
			if (currentUrl) URL.revokeObjectURL(currentUrl);
		};
	}, [file]);

	return (
		<div className="flex h-full overflow-hidden bg-background">
			<div className="flex flex-1 items-center justify-center overflow-auto bg-secondary/5 p-8">
				<ContextMenu>
					<ContextMenuTrigger asChild>
						<div className="group relative cursor-pointer">
							{imageSrc && (
								<img
									src={imageSrc}
									alt={file.name}
									className="max-h-full max-w-full rounded-lg bg-checkered shadow-2xl"
								/>
							)}
						</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem
							onClick={() => {
								if (imageSrc) {
									navigator.clipboard.writeText(imageSrc);
								}
							}}
						>
							<HugeiconsIcon icon={Copy01Icon} className="mr-2 h-3.5 w-3.5" />
							<span>Copy Image URL</span>
						</ContextMenuItem>
						<ContextMenuItem
							onClick={() => {
								if (imageSrc) {
									fetch(imageSrc)
										.then((res) => res.blob())
										.then((blob) => {
											try {
												navigator.clipboard.write([
													new ClipboardItem({
														[blob.type]: blob,
													}),
												]);
											} catch {
												navigator.clipboard.writeText(imageSrc);
											}
										})
										.catch(() => {
											navigator.clipboard.writeText(imageSrc);
										});
								}
							}}
						>
							<HugeiconsIcon icon={Copy01Icon} className="mr-2 h-3.5 w-3.5" />
							<span>Copy Image to Clipboard</span>
						</ContextMenuItem>
						<ContextMenuItem
							onClick={async () => {
								if (!imageSrc) return;
								try {
									const response = await fetch(imageSrc);
									const blob = await response.blob();
									const url = URL.createObjectURL(blob);
									const link = document.createElement("a");
									link.href = url;
									link.download = file.name;
									link.click();
									URL.revokeObjectURL(url);
								} catch (err) {
									console.error("Failed to save image:", err);
								}
							}}
						>
							<HugeiconsIcon
								icon={Download03Icon}
								className="mr-2 h-3.5 w-3.5"
							/>
							<span>Save Image As...</span>
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			</div>

			<div className="w-80 overflow-auto border-l bg-card p-6">
				<div className="mb-6 flex items-center gap-2 border-b pb-4">
					<HugeiconsIcon icon={Image01Icon} className="h-5 w-5 text-primary" />
					<h2 className="truncate font-semibold text-foreground">
						{file.name}
					</h2>
				</div>

				{metadata && (
					<div className="space-y-6">
						<div>
							<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
								File Information
							</h3>
							<div className="space-y-3">
								{metadata.size && (
									<MetaItem
										icon={DatabaseIcon}
										label="Size"
										value={metadata.size}
									/>
								)}
								{metadata.type && (
									<MetaItem
										icon={File01Icon}
										label="Format"
										value={metadata.type}
									/>
								)}
								{metadata.lastModified && (
									<MetaItem
										icon={Calendar03Icon}
										label="Modified"
										value={metadata.lastModified}
									/>
								)}
							</div>
						</div>

						{metadata.dimensions && (
							<div>
								<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
									Dimensions
								</h3>
								<div className="grid grid-cols-2 gap-4 rounded-lg border bg-secondary/20 p-3">
									<div>
										<div className="text-[10px] text-muted-foreground">
											Width
										</div>
										<div className="font-mono text-sm">
											{metadata.dimensions.width}px
										</div>
									</div>
									<div>
										<div className="text-[10px] text-muted-foreground">
											Height
										</div>
										<div className="font-mono text-sm">
											{metadata.dimensions.height}px
										</div>
									</div>
								</div>
							</div>
						)}

						{metadata.exif && (
							<div>
								<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
									Exif Metadata
								</h3>
								<div className="space-y-2 rounded-lg border bg-secondary/10 p-3">
									{Object.entries(metadata.exif).map(([key, value]) => (
										<div
											key={key}
											className="flex items-center justify-between gap-2"
										>
											<span className="font-medium text-[10px] text-muted-foreground">
												{key}
											</span>
											<span className="truncate font-mono text-[10px] text-foreground">
												{value}
											</span>
										</div>
									))}
								</div>
							</div>
						)}

						{metadata.userComment && (
							<div>
								<h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
									User Comment
								</h3>
								<div className="overflow-hidden rounded-lg border bg-secondary/10 p-3">
									<CommentViewer content={metadata.userComment} />
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function CommentViewer({ content }: { content: string }) {
	try {
		const parsed = JSON.parse(content);
		return (
			<pre className="scrollbar-hide overflow-auto font-mono text-[10px] text-foreground">
				{JSON.stringify(parsed, null, 2)}
			</pre>
		);
	} catch (_) {
		return (
			<p className="text-[10px] text-foreground leading-relaxed">{content}</p>
		);
	}
}

function MetaItem({
	icon,
	label,
	value,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: icon is a hugeicons component
	icon: any;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<div className="mt-0.5 rounded bg-secondary/30 p-1.5 text-muted-foreground">
				<HugeiconsIcon icon={icon} size={14} />
			</div>
			<div className="min-w-0">
				<div className="mb-1 font-medium text-[10px] text-muted-foreground leading-none">
					{label}
				</div>
				<div className="truncate font-medium text-foreground text-xs">
					{value}
				</div>
			</div>
		</div>
	);
}
