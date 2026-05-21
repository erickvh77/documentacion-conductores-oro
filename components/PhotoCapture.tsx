"use client";

import { useRef, useCallback } from "react";

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  uploading?: boolean;
  uploadError?: string | null;
  disabled?: boolean;
  /** Texto del botón cuando no está subiendo. Por defecto "Tomar / Subir foto". */
  buttonLabel?: string;
}

/**
 * Botón de captura / selección de foto.
 * No gestiona thumbnails — eso lo hace el componente padre (DocumentItemRow).
 */
export function PhotoCapture({
  onCapture,
  uploading = false,
  uploadError = null,
  disabled = false,
  buttonLabel = "Tomar / Subir foto",
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onCapture(file);
        e.target.value = "";
      }
    },
    [onCapture]
  );

  const triggerCapture = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  // ── Estado: subiendo ─────────────────────────────────────────────────────
  if (uploading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-4">
        <svg
          className="h-5 w-5 animate-spin text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-semibold text-blue-700">Procesando imagen...</span>
      </div>
    );
  }

  // ── Estado: botón para agregar foto ─────────────────────────────────────
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={triggerCapture}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-blue-600 hover:border-blue-400 hover:bg-blue-100 active:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          className="h-6 w-6 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="font-semibold text-sm">{buttonLabel}</span>
      </button>

      {uploadError && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <svg className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700 font-medium">{uploadError}</p>
        </div>
      )}
    </div>
  );
}
