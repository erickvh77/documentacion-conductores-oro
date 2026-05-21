"use client";

/**
 * FormContext — estado global del formulario multi-paso.
 *
 * Soporta dos modos:
 *  - Nuevo registro: flujo estándar (manifiesto → autocompletar desde VIAJES)
 *  - Completar registro existente: se bloquean los docs ya subidos
 *
 * Cada documento ahora admite 1 o más fotos (PhotoEntry[]).
 * CUMPLIDO fue removido del listado activo — no aparece en el formulario.
 */

import React, { createContext, useContext, useReducer, useCallback } from "react";
import { TIPOS_DOCUMENTO, LABELS_DOCUMENTO, SORT_ORDER, type TipoDocumento } from "@/lib/validation/schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepOneValues {
  nombreConductor: string;
  placa: string;
  manifiesto: string;
  clienteId: string;
  clienteNombre: string;
}

/** Una foto individual ya subida al servidor (ruta temporal asignada por /api/upload). */
export interface PhotoEntry {
  id: string;               // UUID local para React key y para eliminar
  thumbnailDataUrl: string;
  tempOriginalPath: string;
  tempProcessedPath: string;
  uploadedAt: string;       // ISO timestamp auto-generado en el cliente
}

export interface DocumentItemState {
  tipoDocumento: TipoDocumento;
  label: string;
  sortOrder: number;
  entregado: boolean | null;    // null = sin responder aún
  descripcion: string;
  // Multi-foto: array de fotos cargadas
  photos: PhotoEntry[];
  addingPhoto: boolean;         // true mientras se procesa /api/upload
  addPhotoError: string | null;
  // Agencia (una por documento, independientemente del nº de fotos)
  agencyName: string;
  // CONTENEDOR_VACIO
  numeroContenedor: string;
  manifiestoContenedor: string;
  // Modo completar: item ya subido en registro anterior
  locked: boolean;
  existingImageUrl: string | null;  // URL de la primera foto en Drive (para "Ver foto")
}

export interface ExistingRecordItem {
  tipoDocumento: TipoDocumento;
  entregado: boolean;
  descripcion: string | null;
  processedImageUrl: string | null;
  agencyName: string | null;
  uploadedAt: string | null;
}

export interface ExistingRecord {
  id: string;
  nombreConductor: string;
  placa: string;
  manifiesto: string | null;
  agencia: string | null;
  clienteId: string;
  clienteNombre: string;
  estado: string;
  driveFolderUrl: string | null;
  items: ExistingRecordItem[];
}

export interface SubmitResult {
  success: boolean;
  recordId?: string;
  pdfUrl?: string;
  error?: string;
}

interface FormState {
  step: 1 | 2 | 3;
  stepOne: StepOneValues | null;
  items: DocumentItemState[];
  isSubmitting: boolean;
  submitResult: SubmitResult | null;
  existingRecord: ExistingRecord | null;
  completionMode: boolean;
}

// ─── Acciones del reducer ─────────────────────────────────────────────────────

type FormAction =
  | { type: "SET_STEP"; payload: 1 | 2 | 3 }
  | { type: "SUBMIT_STEP_ONE"; payload: StepOneValues }
  | { type: "SET_EXISTING_RECORD"; payload: ExistingRecord }
  | { type: "CLEAR_EXISTING_RECORD" }
  | { type: "SET_ENTREGADO"; payload: { tipoDocumento: TipoDocumento; entregado: boolean } }
  | { type: "SET_DESCRIPCION"; payload: { tipoDocumento: TipoDocumento; descripcion: string } }
  | { type: "SET_AGENCY_NAME"; payload: { tipoDocumento: TipoDocumento; agencyName: string } }
  | { type: "SET_NUMERO_CONTENEDOR"; payload: { value: string } }
  | { type: "SET_MANIFIESTO_CONTENEDOR"; payload: { value: string } }
  | { type: "UPLOAD_START"; payload: { tipoDocumento: TipoDocumento } }
  | { type: "UPLOAD_SUCCESS"; payload: { tipoDocumento: TipoDocumento; photo: PhotoEntry } }
  | { type: "UPLOAD_ERROR"; payload: { tipoDocumento: TipoDocumento; error: string } }
  | { type: "REMOVE_PHOTO"; payload: { tipoDocumento: TipoDocumento; photoId: string } }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; payload: SubmitResult }
  | { type: "SUBMIT_ERROR"; payload: string }
  | { type: "RESET" };

// ─── Estado inicial ───────────────────────────────────────────────────────────

function buildInitialItems(): DocumentItemState[] {
  return TIPOS_DOCUMENTO.map((tipo) => ({
    tipoDocumento: tipo,
    label: LABELS_DOCUMENTO[tipo] ?? tipo,
    sortOrder: SORT_ORDER[tipo] ?? 99,
    entregado: null,
    descripcion: "",
    photos: [],
    addingPhoto: false,
    addPhotoError: null,
    agencyName: "",
    numeroContenedor: "",
    manifiestoContenedor: "",
    locked: false,
    existingImageUrl: null,
  }));
}

const initialState: FormState = {
  step: 1,
  stepOne: null,
  items: buildInitialItems(),
  isSubmitting: false,
  submitResult: null,
  existingRecord: null,
  completionMode: false,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.payload };

    case "SUBMIT_STEP_ONE":
      return { ...state, stepOne: action.payload, step: 2 };

    case "SET_EXISTING_RECORD": {
      const existing = action.payload;
      const updatedItems = buildInitialItems().map((item) => {
        const found = existing.items.find((ei) => ei.tipoDocumento === item.tipoDocumento);
        if (found && found.entregado && found.processedImageUrl) {
          return {
            ...item,
            locked: true,
            entregado: true,
            existingImageUrl: found.processedImageUrl,
            descripcion: found.descripcion ?? "",
            agencyName: found.agencyName ?? "",
          };
        }
        return item;
      });
      return { ...state, existingRecord: existing, completionMode: true, items: updatedItems };
    }

    case "CLEAR_EXISTING_RECORD":
      return { ...state, existingRecord: null, completionMode: false, items: buildInitialItems() };

    case "SET_ENTREGADO":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === action.payload.tipoDocumento && !item.locked
            ? {
                ...item,
                entregado: action.payload.entregado,
                ...(!action.payload.entregado && {
                  photos: [],
                  addingPhoto: false,
                  addPhotoError: null,
                  descripcion: "",
                  agencyName: "",
                  numeroContenedor: "",
                  manifiestoContenedor: "",
                }),
              }
            : item
        ),
      };

    case "SET_DESCRIPCION":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === action.payload.tipoDocumento && !item.locked
            ? { ...item, descripcion: action.payload.descripcion }
            : item
        ),
      };

    case "SET_AGENCY_NAME":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === action.payload.tipoDocumento && !item.locked
            ? { ...item, agencyName: action.payload.agencyName }
            : item
        ),
      };

    case "SET_NUMERO_CONTENEDOR":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === "CONTENEDOR_VACIO" && !item.locked
            ? { ...item, numeroContenedor: action.payload.value }
            : item
        ),
      };

    case "SET_MANIFIESTO_CONTENEDOR":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === "CONTENEDOR_VACIO" && !item.locked
            ? { ...item, manifiestoContenedor: action.payload.value }
            : item
        ),
      };

    case "UPLOAD_START":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === action.payload.tipoDocumento && !item.locked
            ? { ...item, addingPhoto: true, addPhotoError: null }
            : item
        ),
      };

    case "UPLOAD_SUCCESS":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === action.payload.tipoDocumento && !item.locked
            ? {
                ...item,
                addingPhoto: false,
                addPhotoError: null,
                photos: [...item.photos, action.payload.photo],
              }
            : item
        ),
      };

    case "UPLOAD_ERROR":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === action.payload.tipoDocumento && !item.locked
            ? { ...item, addingPhoto: false, addPhotoError: action.payload.error }
            : item
        ),
      };

    case "REMOVE_PHOTO":
      return {
        ...state,
        items: state.items.map((item) =>
          item.tipoDocumento === action.payload.tipoDocumento && !item.locked
            ? { ...item, photos: item.photos.filter((p) => p.id !== action.payload.photoId) }
            : item
        ),
      };

    case "SUBMIT_START":
      return { ...state, isSubmitting: true, submitResult: null };

    case "SUBMIT_SUCCESS":
      return { ...state, isSubmitting: false, submitResult: action.payload, step: 3 };

    case "SUBMIT_ERROR":
      return {
        ...state,
        isSubmitting: false,
        submitResult: { success: false, error: action.payload },
      };

    case "RESET":
      return { ...initialState, items: buildInitialItems() };

    default:
      return state;
  }
}

// ─── Context y Provider ───────────────────────────────────────────────────────

interface FormContextValue {
  state: FormState;
  goToStep: (step: 1 | 2 | 3) => void;
  submitStepOne: (values: StepOneValues) => void;
  setExistingRecord: (record: ExistingRecord) => void;
  clearExistingRecord: () => void;
  setEntregado: (tipoDocumento: TipoDocumento, entregado: boolean) => void;
  setDescripcion: (tipoDocumento: TipoDocumento, descripcion: string) => void;
  setAgencyName: (tipoDocumento: TipoDocumento, agencyName: string) => void;
  setNumeroContenedor: (value: string) => void;
  setManifiestoContenedor: (value: string) => void;
  uploadPhoto: (tipoDocumento: TipoDocumento, file: File) => Promise<void>;
  removePhoto: (tipoDocumento: TipoDocumento, photoId: string) => void;
  submitRecord: () => Promise<void>;
  canProceedFromStep2: () => boolean;
  getStep2Errors: () => string[];
  resetForm: () => void;
}

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialState);

  const goToStep = useCallback((step: 1 | 2 | 3) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const submitStepOne = useCallback((values: StepOneValues) => {
    dispatch({ type: "SUBMIT_STEP_ONE", payload: values });
  }, []);

  const setExistingRecord = useCallback((record: ExistingRecord) => {
    dispatch({ type: "SET_EXISTING_RECORD", payload: record });
  }, []);

  const clearExistingRecord = useCallback(() => {
    dispatch({ type: "CLEAR_EXISTING_RECORD" });
  }, []);

  const setEntregado = useCallback((tipoDocumento: TipoDocumento, entregado: boolean) => {
    dispatch({ type: "SET_ENTREGADO", payload: { tipoDocumento, entregado } });
  }, []);

  const setDescripcion = useCallback((tipoDocumento: TipoDocumento, descripcion: string) => {
    dispatch({ type: "SET_DESCRIPCION", payload: { tipoDocumento, descripcion } });
  }, []);

  const setAgencyName = useCallback((tipoDocumento: TipoDocumento, agencyName: string) => {
    dispatch({ type: "SET_AGENCY_NAME", payload: { tipoDocumento, agencyName } });
  }, []);

  const setNumeroContenedor = useCallback((value: string) => {
    dispatch({ type: "SET_NUMERO_CONTENEDOR", payload: { value } });
  }, []);

  const setManifiestoContenedor = useCallback((value: string) => {
    dispatch({ type: "SET_MANIFIESTO_CONTENEDOR", payload: { value } });
  }, []);

  /** Sube una foto nueva al servidor y la añade al array photos del item. */
  const uploadPhoto = useCallback(async (tipoDocumento: TipoDocumento, file: File) => {
    dispatch({ type: "UPLOAD_START", payload: { tipoDocumento } });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al subir la imagen");

      const photo: PhotoEntry = {
        id: json.uploadId,
        thumbnailDataUrl: json.thumbnailDataUrl,
        tempOriginalPath: json.tempOriginalPath,
        tempProcessedPath: json.tempProcessedPath,
        uploadedAt: new Date().toISOString(),
      };
      dispatch({ type: "UPLOAD_SUCCESS", payload: { tipoDocumento, photo } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      dispatch({ type: "UPLOAD_ERROR", payload: { tipoDocumento, error: message } });
    }
  }, []);

  /** Elimina una foto del array por su ID local. */
  const removePhoto = useCallback((tipoDocumento: TipoDocumento, photoId: string) => {
    dispatch({ type: "REMOVE_PHOTO", payload: { tipoDocumento, photoId } });
  }, []);

  const getStep2Errors = useCallback((): string[] => {
    const errors: string[] = [];
    for (const item of state.items) {
      if (item.locked) continue;
      if (item.entregado === null) {
        errors.push(`"${item.label}": debe seleccionar Sí o No`);
        continue;
      }
      if (!item.entregado) continue;
      if (item.photos.length === 0) {
        errors.push(`"${item.label}": al menos una foto es obligatoria`);
      }
      if (!item.agencyName) {
        errors.push(`"${item.label}": debe seleccionar la agencia`);
      }
      if (item.tipoDocumento === "OTROS" && !item.descripcion.trim()) {
        errors.push(`"${item.label}": la descripción es obligatoria`);
      }
      if (item.tipoDocumento === "CONTENEDOR_VACIO" && !item.numeroContenedor.trim()) {
        errors.push(`"${item.label}": el número de contenedor es obligatorio`);
      }
    }
    return errors;
  }, [state.items]);

  const canProceedFromStep2 = useCallback((): boolean => {
    return getStep2Errors().length === 0;
  }, [getStep2Errors]);

  const submitRecord = useCallback(async () => {
    if (!state.stepOne) return;
    dispatch({ type: "SUBMIT_START" });

    // Mapea un item del estado al payload de la API
    const mapItem = (item: DocumentItemState) => ({
      tipoDocumento: item.tipoDocumento,
      entregado: item.entregado ?? false,
      descripcion: item.descripcion || undefined,
      photos: item.photos.map((p) => ({
        tempOriginalPath: p.tempOriginalPath,
        tempProcessedPath: p.tempProcessedPath,
        uploadedAt: p.uploadedAt,
      })),
      agencyName: item.agencyName || undefined,
      uploadedAt: item.photos[0]?.uploadedAt || undefined,
      numeroContenedor:
        item.tipoDocumento === "CONTENEDOR_VACIO" ? item.numeroContenedor || undefined : undefined,
      manifiestoContenedor:
        item.tipoDocumento === "CONTENEDOR_VACIO" ? item.manifiestoContenedor || undefined : undefined,
    });

    try {
      // ── Modo completar registro existente ──────────────────────────────────
      if (state.completionMode && state.existingRecord) {
        const newItems = state.items
          .filter((i) => !i.locked && i.entregado !== null)
          .map(mapItem);

        const res = await fetch(`/api/records/${state.existingRecord.id}/complete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: newItems }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Error al agregar documentos");
        dispatch({
          type: "SUBMIT_SUCCESS",
          payload: { success: true, recordId: json.recordId, pdfUrl: json.pdfUrl },
        });
        return;
      }

      // ── Registro nuevo ─────────────────────────────────────────────────────
      const contenedorItem = state.items.find(
        (i) => i.tipoDocumento === "CONTENEDOR_VACIO" && i.entregado
      );

      const payload = {
        ...state.stepOne,
        numeroContenedor: contenedorItem?.numeroContenedor || undefined,
        manifiestoContenedor: contenedorItem?.manifiestoContenedor || undefined,
        items: state.items.filter((i) => i.entregado !== null).map(mapItem),
      };

      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al guardar el registro");
      dispatch({
        type: "SUBMIT_SUCCESS",
        payload: { success: true, recordId: json.recordId, pdfUrl: json.pdfUrl },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      dispatch({ type: "SUBMIT_ERROR", payload: message });
    }
  }, [state.stepOne, state.items, state.completionMode, state.existingRecord]);

  const resetForm = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return (
    <FormContext.Provider
      value={{
        state,
        goToStep,
        submitStepOne,
        setExistingRecord,
        clearExistingRecord,
        setEntregado,
        setDescripcion,
        setAgencyName,
        setNumeroContenedor,
        setManifiestoContenedor,
        uploadPhoto,
        removePhoto,
        submitRecord,
        canProceedFromStep2,
        getStep2Errors,
        resetForm,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useForm() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("useForm debe usarse dentro de <FormProvider>");
  return ctx;
}
