import PhotoUpload from "@/components/PhotoUpload";

export type VehiclePhotos = { frente?: string; tras?: string; esquerdo?: string; direito?: string };
export const VEHICLE_PHOTO_SIDES: { key: keyof VehiclePhotos; label: string }[] = [
  { key: 'frente', label: 'Foto da frente' },
  { key: 'tras', label: 'Foto de trás' },
  { key: 'esquerdo', label: 'Foto do lado esquerdo' },
  { key: 'direito', label: 'Foto do lado direito' },
];
export const vehiclePhotosComplete = (p: VehiclePhotos) => VEHICLE_PHOTO_SIDES.every(s => !!p[s.key]);

export default function ChecklistVehiclePhotos({ value, onChange }: { value: VehiclePhotos; onChange: (v: VehiclePhotos) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1">Fotos do veículo (obrigatórias)</p>
      <p className="text-xs text-muted-foreground mb-3">Tire as 4 fotos: frente, trás e os dois lados.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VEHICLE_PHOTO_SIDES.map(s => (
          <PhotoUpload key={s.key} label={s.label} required value={value[s.key]}
            onUploaded={(url) => onChange({ ...value, [s.key]: url || undefined })} />
        ))}
      </div>
    </div>
  );
}
