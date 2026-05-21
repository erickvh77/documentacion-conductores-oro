"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DocumentItemRow } from "@/components/form/DocumentItemRow";
import { useForm } from "@/lib/context/FormContext";

export function StepTwo() {
  const { state, goToStep, canProceedFromStep2, getStep2Errors } = useForm();
  const [showErrors, setShowErrors] = useState(false);

  const errors = getStep2Errors();
  const canProceed = errors.length === 0;

  const { completionMode, existingRecord } = state;

  // En modo completar, solo contar items no bloqueados
  const editableItems = state.items.filter((i) => !i.locked);
  const lockedItems = state.items.filter((i) => i.locked);

  const answered = editableItems.filter((i) => i.entregado !== null).length;
  const total = editableItems.length;
  const entregados = editableItems.filter((i) => i.entregado === true).length;

  const handleNext = () => {
    if (!canProceed) {
      setShowErrors(true);
      const el = document.getElementById("step2-errors");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    goToStep(3);
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {completionMode ? "Agregar documentos faltantes" : "Documentos entregados"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {completionMode
            ? "Los documentos marcados en verde ya fueron cargados. Indique los nuevos."
            : "Seleccione Sí o No para cada documento. Si selecciona Sí, debe tomar una foto."}
        </p>
      </div>

      {/* Banner modo completar */}
      {completionMode && existingRecord && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm flex items-start gap-2">
          <svg className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <div>
            <span className="font-semibold text-amber-800">Completando registro existente</span>
            <span className="text-amber-700"> — Manifiesto {existingRecord.manifiesto} · {existingRecord.placa}</span>
            {existingRecord.driveFolderUrl && (
              <a
                href={existingRecord.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-xs text-amber-700 underline"
              >
                Ver carpeta Drive
              </a>
            )}
          </div>
        </div>
      )}

      {/* Resumen del viaje */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-500">Conductor:</span>
          <span className="font-semibold text-gray-900">{state.stepOne?.nombreConductor}</span>
          <span className="text-gray-500">Placa:</span>
          <span className="font-semibold text-gray-900">{state.stepOne?.placa}</span>
          {state.stepOne?.manifiesto && (
            <>
              <span className="text-gray-500">Manifiesto:</span>
              <span className="font-semibold text-gray-900">{state.stepOne.manifiesto}</span>
            </>
          )}
          <span className="text-gray-500">Cliente:</span>
          <span className="font-semibold text-gray-900 truncate">{state.stepOne?.clienteNombre}</span>
        </div>
      </div>

      {/* Barra de progreso (solo items editables) */}
      {total > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
          <div className="flex justify-between text-xs font-semibold text-gray-600 mb-2">
            <span>{answered}/{total} respondidos</span>
            <span>{entregados} nuevos a cargar</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Errores de validación */}
      {showErrors && !canProceed && (
        <div id="step2-errors" className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700 mb-2">
            Corrija lo siguiente antes de continuar:
          </p>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((err, i) => (
              <li key={i} className="text-sm text-red-600">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Items ya cargados (bloqueados) */}
      {lockedItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Ya cargados ({lockedItems.length})
          </p>
          {lockedItems.map((item) => (
            <DocumentItemRow key={item.tipoDocumento} item={item} />
          ))}
        </div>
      )}

      {/* Items editables */}
      {total > 0 && (
        <div className="flex flex-col gap-3">
          {lockedItems.length > 0 && (
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Pendientes ({total})
            </p>
          )}
          {editableItems.map((item) => (
            <DocumentItemRow key={item.tipoDocumento} item={item} />
          ))}
        </div>
      )}

      {/* Navegación */}
      <div className="flex flex-col gap-3 pt-2">
        <Button fullWidth onClick={handleNext}>
          Revisar y confirmar →
        </Button>
        <Button variant="secondary" fullWidth onClick={() => goToStep(1)}>
          ← Volver
        </Button>
      </div>
    </div>
  );
}
