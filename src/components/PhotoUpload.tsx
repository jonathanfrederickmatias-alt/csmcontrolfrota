import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, ImageIcon } from "lucide-react";

interface PhotoUploadProps {
  onUploaded: (url: string) => void;
  label?: string;
  required?: boolean;
  value?: string;
}

export default function PhotoUpload({ onUploaded, label = "Foto", required = false, value }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `uploads/${fileName}`;

    const { error } = await supabase.storage.from('photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (!error) {
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      setPreview(publicUrl);
      onUploaded(publicUrl);
    }
    setUploading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onUploaded('');
    if (inputRef.current) inputRef.current.value = '';
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
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={preview} alt="Foto" className="w-full h-48 object-cover" />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-24 border-dashed flex flex-col gap-1"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Camera className="w-6 h-6" />
              <span className="text-xs">Tirar foto ou selecionar</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
