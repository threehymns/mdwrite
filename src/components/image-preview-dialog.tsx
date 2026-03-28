import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ImagePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  src: string | null;
  fileName: string | null;
}

export function ImagePreviewDialog({
  isOpen,
  onClose,
  src,
  fileName,
}: ImagePreviewDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
        <AlertDialogHeader className="sr-only">
          <AlertDialogTitle>{fileName}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="relative flex flex-col items-center gap-4">
          <div className="overflow-hidden rounded-lg bg-black/50 p-2 backdrop-blur-sm">
            {src && (
              <img
                src={src}
                alt={fileName || "Preview"}
                className="max-h-[80vh] w-auto object-contain"
              />
            )}
          </div>
          <div className="rounded-full bg-black/50 px-4 py-2 text-white text-xs backdrop-blur-sm">
            {fileName}
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
