import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, Paperclip, FileText } from "lucide-react";
import { uploadOrQueuePhoto, OFFLINE_PHOTO_PREFIX } from "@/lib/offline";

interface PhotoUploadProps {
  onUploaded: (url: string) => void;
  label?: string;
  required?: boolean;
  value?: string;
  acceptFiles?: boolean;
}

export default function PhotoUpload({ onUploaded, label = "Foto", required = false, value, acceptFiles = false }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [pendingOffline, setPendingOffline] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = (url: string) => url.startsWith('blob:') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);

  const handleFile = async (file: File) => {
    setUploading(true);
    const ref = await uploadOrQueuePhoto(file);
    const offline = ref.startsWith(OFFLINE_PHOTO_PREFIX);
    setPendingOffline(offline);
    setPreview(offline ? URL.createObjectURL(file) : ref);
    setFileName(file.name);
    onUploaded(ref);
    setUploading(false);
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName(null);
    onUploaded('');
    if (inputRef.current) inputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <p className="text-sm font-medium mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      {acceptFiles && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleChange}
          className="hidden"
        />
      )}
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          {pendingOffline && (
            <span className="absolute top-2 left-2 z-10 rounded bg-warning px-2 py-0.5 text-[10px] font-bold text-warning-foreground">
              Salva no aparelho
            </span>
          )}
          {isImage(preview) ? (
            <img src={preview} alt="Foto" className="w-full h-48 object-cover" />

          ) : (
            <div className="w-full h-48 flex flex-col items-center justify-center bg-secondary/30 gap-2">
              <FileText className="w-10 h-10 text-primary" />
              <span className="text-xs text-muted-foreground truncate max-w-[80%]">{fileName || 'Arquivo anexado'}</span>
              <a href={preview} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Abrir arquivo</a>
            </div>
          )}
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className={`flex gap-2 ${acceptFiles ? '' : 'w-full'}`}>
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`${acceptFiles ? 'flex-1' : 'w-full'} h-24 border-dashed flex flex-col gap-1`}
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Camera className="w-6 h-6" />
                <span className="text-xs">Tirar foto</span>
              </>
            )}
          </Button>
          {acceptFiles && (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 h-24 border-dashed flex flex-col gap-1"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Paperclip className="w-6 h-6" />
                  <span className="text-xs">Anexar arquivo</span>
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
