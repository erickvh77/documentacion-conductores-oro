"use client";

import { PhotoCapture } from "@/components/PhotoCapture";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useForm } from "@/lib/context/FormContext";
import type { DocumentItemState, PhotoEntry } from "@/lib/context/FormContext";
import { AGENCIAS } from "@/lib/validation/schemas";

interface DocumentItemRowProps {
  item: DocumentItemState;
}

const AGENCIA_OPTIONS = AGENCIAS.map((a) => ({ value: a, label: a }));

function formatUploadedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DocumentItemRow({ item }: DocumentItemRowProps) {
  const {
    setEntregado,
    setDescripcion,
    setAgencyName,
    setNumeroContenedor,
    setManifiestoContenedor,
    uploadPhoto,
    removePhoto,
  } = useForm();

  const isContenedor = item.tipoDocumento === "CONTENEDOR_VACIO";
  const isOtros = item.tipoDocumento === "OTROS";

  // ── Item ya subido en registro anterior (modo completar) ──────────────────
  if (item.locked) {
    return (
      <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4 opacity-80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <div className="min-w-0">
              <span className="text-base font-semibold text-gray-900 truncate block">{item.label}</span>
              {item.agencyName && (
                <span className="text-xs text-green-700">Agencia: {item.agencyName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.existingImageUrl && (
              <a
                href={item.existingImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-700 underline font-medium"
              >
                Ver foto
              </a>
            )}
            <span className="rounded-lg bg-green-200 px-3 py-1 text-xs font-bold text-green-800">
              Ya cargado
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Item editable ─────────────────────────────────────────────────────────
  return (
    <div
      className={[
        "rounded-2xl border-2 p-4 transition-colors",
        item.entregado === true
          ? "border-green-300 bg-green-50"
          : item.entregado === false
          ? "border-gray-200 bg-gray-50"
          : "border-gray-200 bg-white",
      ].join(" ")}
    >
      {/* Encabezado: nombre + botones Sí/No */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-semibold text-gray-900 leading-tight flex-1">
          {item.label}
        </span>

        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setEntregado(item.tipoDocumento, true)}
            className={[
              "h-11 w-16 rounded-xl text-sm font-bold transition-all",
              item.entregado === true
                ? "bg-green-500 text-white shadow-md scale-105"
                : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700",
            ].join(" ")}
          >
            Sí
          </button>

          <button
            type="button"
            onClick={() => setEntregado(item.tipoDocumento, false)}
            className={[
              "h-11 w-16 rounded-xl text-sm font-bold transition-all",
              item.entregado === false
                ? "bg-red-400 text-white shadow-md scale-105"
                : "bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600",
            ].join(" ")}
          >
            No
          </button>
        </div>
      </div>

      {/* Contenido expandido cuando está en Sí */}
      {item.entregado === true && (
        <div className="mt-3 flex flex-col gap-3 border-t border-green-200 pt-3">

          {isContenedor && (
            <>
              <Input
                label="Número de contenedor"
                placeholder="Ej. ABCD1234567"
                required
                autoCapitalize="characters"
                value={item.numeroContenedor}
                onChange={(e) => setNumeroContenedor(e.target.value.toUpperCase())}
                error={
                  item.entregado && !item.numeroContenedor.trim()
                    ? "El número de contenedor es obligatorio"
                    : undefined
                }
              />
              <Input
                label="Manifiesto asociado al contenedor"
                placeholder="Ej. 456789 (opcional)"
                value={item.manifiestoContenedor}
                onChange={(e) => setManifiestoContenedor(e.target.value)}
                hint="Si aplica, ingrese el número de manifiesto relacionado"
              />
            </>
          )}

          {isOtros && (
            <Input
              label="Descripción del documento"
              placeholder="Ej. Carta de porte, Acta de recibo..."
              required
              value={item.descripcion}
              onChange={(e) => setDescripcion(item.tipoDocumento, e.target.value)}
              error={
                item.entregado && !item.descripcion.trim()
                  ? "La descripción es obligatoria"
                  : undefined
              }
            />
          )}

          {/* Sección de fotos (multi-foto) */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Fotos del documento
              <span className="ml-1 text-red-500">*</span>
              {item.photos.length > 0 && (
                <span className="ml-2 font-normal normal-case text-green-700">
                  ({item.photos.length} cargada{item.photos.length !== 1 ? "s" : ""})
                </span>
              )}
            </p>

            {/* Lista de fotos ya subidas */}
            {item.photos.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {item.photos.map((photo, idx) => (
                  <PhotoThumbnail
                    key={photo.id}
                    photo={photo}
                    index={idx + 1}
                    onRemove={() => removePhoto(item.tipoDocumento, photo.id)}
                  />
                ))}
              </div>
            )}

            {/* Botón agregar foto */}
            <PhotoCapture
              onCapture={(file) => uploadPhoto(item.tipoDocumento, file)}
              uploading={item.addingPhoto}
              uploadError={item.addPhotoError}
              buttonLabel={item.photos.length === 0 ? "Tomar / Subir foto" : "Agregar otra foto"}
            />
          </div>

          {/* Agencia */}
          <Select
            label="Agencia"
            options={AGENCIA_OPTIONS}
            placeholder="Seleccionar agencia..."
            required
            value={item.agencyName}
            onChange={(e) => setAgencyName(item.tipoDocumento, e.target.value)}
            error={
              item.entregado && item.photos.length > 0 && !item.agencyName
                ? "Debe seleccionar la agencia"
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Thumbnail de una foto individual ────────────────────────────────────────

function PhotoThumbnail({
  photo,
  index,
  onRemove,
}: {
  photo: PhotoEntry;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-green-300 bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnailDataUrl}
        alt={`Foto ${index}`}
        className="w-full object-contain max-h-48"
      />

      {/* Badge número de foto */}
      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-1 text-white text-xs font-bold shadow">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Foto {index}
      </div>

      {/* Botón eliminar */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 flex items-center justify-center h-7 w-7 rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition-colors"
        title="Eliminar foto"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
