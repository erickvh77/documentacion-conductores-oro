"use client";

import { ProgressBar } from "@/components/ProgressBar";
import { StepOne } from "@/components/form/StepOne";
import { StepTwo } from "@/components/form/StepTwo";
import { StepThree } from "@/components/form/StepThree";
import { useForm } from "@/lib/context/FormContext";

/**
 * Orquestador del formulario multi-paso.
 * Renderiza el paso activo y la barra de progreso.
 */
export function FormShell() {
  const { state } = useForm();
  const { step } = state;

  // Ocultar barra de progreso en la pantalla de éxito final
  const showProgress = !(step === 3 && state.submitResult?.success);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header fijo */}
      <header className="sticky top-0 z-20 bg-blue-700 text-white shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-blue-200 leading-none">
              Documentación de conductores
            </p>
            <p className="text-base font-bold leading-tight">Registro de viaje</p>
          </div>
        </div>
      </header>

      {/* Barra de progreso */}
      {showProgress && <ProgressBar currentStep={step} />}

      {/* Contenido del paso activo */}
      <main className="flex-1 max-w-lg mx-auto w-full">
        <div className="bg-white min-h-full shadow-sm">
          {step === 1 && <StepOne />}
          {step === 2 && <StepTwo />}
          {step === 3 && <StepThree />}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-lg mx-auto w-full px-4 py-3 text-center">
        <p className="text-xs text-gray-400">
          Sistema de gestión documental — v1.0
        </p>
      </footer>
    </div>
  );
}
