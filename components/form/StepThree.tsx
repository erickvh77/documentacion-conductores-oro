"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useForm } from "@/lib/context/FormContext";
import { LABELS_DOCUMENTO } from "@/lib/validation/schemas";

export function StepThree() {
  const { state, goToStep, submitRecord, resetForm } = useForm();
  const [confirmed, setConfirmed] = useState(false);

  const entregados = state.items.filter((i) => i.entregado === true);
  const noEntregados = state.items.filter((i) => i.entregado === false);
  const contenedorItem = state.items.find(
    (i) => i.tipoDocumento === "CONTENEDOR_VACIO" && i.entregado === true
  );

  // ── Pantalla de éxito ─────────────────────────────────────────────────────
  if (state.submitResult?.success) {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-12 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-14 w-14 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">¡Registro guardado!</h2>
          <p className="mt-2 text-gray-500 text-base">
            La documentación de{" "}
            <span className="font-semibold text-gray-800">{state.stepOne?.placa}</span>{" "}
            fue registrada correctamente.
          </p>
        </div>

        <div className="w-full max-w-xs rounded-2xl bg-gray-50 border border-gray-200 p-4 text-left text-sm">
          <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Resumen</p>
          <div className="flex flex-col gap-1.5">
            <SummaryRow label="Conductor" value={state.stepOne?.nombreConductor ?? ""} />
            <SummaryRow label="Placa" value={state.stepOne?.placa ?? ""} />
            {state.stepOne?.manifiesto && (
              <SummaryRow label="Manifiesto" value={state.stepOne.manifiesto} />
            )}
            <SummaryRow label="Cliente" value={state.stepOne?.clienteNombre ?? ""} />
            <SummaryRow label="Documentos entregados" value={String(entregados.length)} />
          </div>
        </div>

        {state.submitResult.pdfUrl && (
          <a
            href={state.submitResult.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ver PDF generado
          </a>
        )}

        <Button variant="secondary" fullWidth onClick={resetForm}>
          Nuevo registro
        </Button>
      </div>
    );
  }

  // ── Pantalla de error al enviar ───────────────────────────────────────────
  if (state.submitResult && !state.submitResult.success) {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-12 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
          <svg className="h-14 w-14 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Error al guardar</h2>
          <p className="mt-2 text-gray-500 text-sm">{state.submitResult.error}</p>
        </div>
        <Button fullWidth onClick={submitRecord} loading={state.isSubmitting}>
          Reintentar
        </Button>
        <Button variant="secondary" fullWidth onClick={() => goToStep(2)}>
          Volver a documentos
        </Button>
      </div>
    );
  }

  // ── Confirmación (estado normal del Paso 3) ───────────────────────────────
  if (!confirmed) {
    return (
      <div className="flex flex-col gap-5 px-4 py-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Resumen del registro</h2>
          <p className="mt-1 text-sm text-gray-500">
            Revise la información antes de confirmar
          </p>
        </div>

        {/* Datos del viaje */}
        <SummaryCard title="Datos del viaje">
          <SummaryRow label="Conductor" value={state.stepOne?.nombreConductor ?? ""} />
          <SummaryRow label="Placa" value={state.stepOne?.placa ?? ""} />
          <SummaryRow
            label="Manifiesto"
            value={state.stepOne?.manifiesto || "—"}
          />
          <SummaryRow label="Cliente" value={state.stepOne?.clienteNombre ?? ""} />
          {contenedorItem && (
            <>
              <SummaryRow
                label="N° Contenedor"
                value={contenedorItem.numeroContenedor || "—"}
              />
            </>
          )}
        </SummaryCard>

        {/* Documentos entregados */}
        {entregados.length > 0 && (
          <SummaryCard title={`Entregados (${entregados.length})`}>
            <div className="flex flex-col gap-3">
              {entregados.map((item) => (
                <div key={item.tipoDocumento} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="font-semibold text-sm text-gray-800">{item.label}</span>
                  </div>
                  {item.descripcion && (
                    <p className="ml-7 text-xs text-gray-600 italic">"{item.descripcion}"</p>
                  )}
                  {/* Miniaturas de todas las fotos cargadas */}
                  {item.photos.length > 0 && (
                    <div className="ml-7 flex flex-wrap gap-2">
                      {item.photos.map((photo, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={photo.id}
                          src={photo.thumbnailDataUrl}
                          alt={`Foto ${idx + 1} de ${item.label}`}
                          className="w-20 rounded-lg border border-gray-200 object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SummaryCard>
        )}

        {/* Documentos no entregados */}
        {noEntregados.length > 0 && (
          <SummaryCard title={`No entregados (${noEntregados.length})`}>
            <div className="flex flex-col gap-1.5">
              {noEntregados.map((item) => (
                <div key={item.tipoDocumento} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-300">
                    <svg className="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </SummaryCard>
        )}

        {/* Botones */}
        <div className="flex flex-col gap-3 pt-2">
          <Button fullWidth onClick={() => setConfirmed(true)}>
            Confirmar y guardar
          </Button>
          <Button variant="secondary" fullWidth onClick={() => goToStep(2)}>
            ← Volver a documentos
          </Button>
        </div>
      </div>
    );
  }

  // ── Diálogo de confirmación final ─────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 px-4 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
        <svg className="h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">¿Confirmar registro?</h2>
        <p className="mt-2 text-gray-500 text-sm">
          Se guardarán {entregados.length} documentos entregados.
          {entregados.length > 0 && " Se generará el PDF y se subirá a Google Drive."}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          fullWidth
          loading={state.isSubmitting}
          onClick={submitRecord}
        >
          {state.isSubmitting ? "Guardando..." : "Sí, guardar registro"}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={state.isSubmitting}
          onClick={() => setConfirmed(false)}
        >
          Revisar de nuevo
        </Button>
      </div>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}:</span>
      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}
