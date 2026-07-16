import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, Paperclip, FileText, Plus } from "lucide-react";

interface MultiPhotoUploadProps {
  label?: string;
  values: string[];
  onChange: (urls: string[]) => void;
  acceptFiles?: boolean;
  required?: boolean;
}

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);

export default function MultiPhotoUpload({
  label = "Fotos",
  values,
  onChange,
  acceptFiles = false,
  required = false,
}: MultiPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const fName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `uploads/${fName}`;
      const { error } = await supabase.storage.from('photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (!error) {
        const { data } = supabase.storage.from('photos').getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
    }
    if (uploaded.length) onChange([...(values || []), ...uploaded]);
    setUploading(false);
    if (cameraRef.current) cameraRef.current.value = '';
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAt = (idx: number) => {
    const next = [...values];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div>
      <p className="text-sm font-medium mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
        {values?.length > 0 && (
          <span className="text-muted-foreground font-normal"> ({values.length})</span>
        )}
      </p>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={e => uploadFiles(e.target.files)}
        className="hidden"
      />
      {acceptFiles && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          multiple
          onChange={e => uploadFiles(e.target.files)}
          className="hidden"
        />
      )}

      {values?.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {values.map((url, idx) => (
            <div key={url + idx} className="relative rounded-lg overflow-hidden border border-border group">
              {isImage(url) ? (
                <a href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover" />
                </a>
              ) : (
                <a href={url} target="_blank" rel="noreferrer" className="w-full h-24 flex flex-col items-center justify-center bg-secondary/30 gap-1 text-xs">
                  <FileText className="w-6 h-6 text-primary" />
                  <span className="text-primary underline truncate max-w-[90%]">Arquivo</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                aria-label="Remover"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="flex-1 h-16 border-dashed flex flex-col gap-1"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Camera className="w-5 h-5" />
              <span className="text-xs">{values?.length ? 'Adicionar foto' : 'Tirar foto'}</span>
            </>
          )}
        </Button>
        {acceptFiles && (
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 h-16 border-dashed flex flex-col gap-1"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Paperclip className="w-5 h-5" />
                <span className="text-xs">Anexar arquivo</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
