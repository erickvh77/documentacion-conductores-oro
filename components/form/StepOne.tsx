"use client";

import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useForm } from "@/lib/context/FormContext";
import type { ExistingRecord } from "@/lib/context/FormContext";
import { LABELS_DOCUMENTO } from "@/lib/validation/schemas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ViajeData {
  manifiesto: string;
  clienteNombre: string;
  clienteId: string;
  placa: string;
  conductor: string;
}

type BusquedaEstado =
  | "idle"
  | "buscando"
  | "encontrado"
  | "no_encontrado"
  | "error";

// ─── Componente ───────────────────────────────────────────────────────────────

export function StepOne() {
  const { submitStepOne, setExistingRecord, clearExistingRecord } = useForm();

  // Campo del formulario
  const [manifiesto, setManifiesto] = useState("");

  // Estado de búsqueda en VIAJES
  const [estadoBusqueda, setEstadoBusqueda] = useState<BusquedaEstado>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [viajeData, setViajeData] = useState<ViajeData | null>(null);

  // Registro existente (incompleto en BD)
  const [foundRecord, setFoundRecord] = useState<ExistingRecord | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Búsqueda automática debounced 800ms ─────────────────────────────────
  useEffect(() => {
    const clean = manifiesto.trim();

    // Resetear al cambiar manifiesto
    setViajeData(null);
    setFoundRecord(null);
    setErrorMsg("");
    clearExistingRecord();

    if (clean.length < 4) {
      setEstadoBusqueda("idle");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setEstadoBusqueda("buscando");

      try {
        // 1. Buscar en VIAJES sheet
        const viajesRes = await fetch(`/api/viajes/${encodeURIComponent(clean)}`);
        const viajesJson = await viajesRes.json();

        if (!viajesJson.found) {
          setEstadoBusqueda("no_encontrado");
          setErrorMsg(viajesJson.error ?? "No se encontró información para el manifiesto ingresado.");
          return;
        }

        const viaje: ViajeData = {
          manifiesto: viajesJson.manifiesto,
          clienteNombre: viajesJson.clienteNombre,
          clienteId: viajesJson.clienteId,
          placa: viajesJson.placa,
          conductor: viajesJson.conductor,
        };
        setViajeData(viaje);

        // 2. Buscar si ya existe un registro incompleto en BD
        const searchRes = await fetch(
          `/api/records/search?manifiesto=${encodeURIComponent(clean)}&placa=${encodeURIComponent(viaje.placa)}`
        );
        const searchJson = await searchRes.json();
        if (searchJson.found) {
          setFoundRecord(searchJson.record);
        }

        setEstadoBusqueda("encontrado");
      } catch {
        setEstadoBusqueda("error");
        setErrorMsg(
          "No fue posible consultar la información del viaje. Intente nuevamente."
        );
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifiesto]);

  // ── Continuar con nuevo registro ──────────────────────────────────────────
  const handleNuevoRegistro = () => {
    if (!viajeData) return;
    submitStepOne({
      nombreConductor: viajeData.conductor,
      placa: viajeData.placa,
      manifiesto: viajeData.manifiesto,
      clienteId: viajeData.clienteId,
      clienteNombre: viajeData.clienteNombre,
    });
  };

  // ── Completar registro existente ──────────────────────────────────────────
  const handleCompleteExisting = () => {
    if (!foundRecord || !viajeData) return;
    setExistingRecord(foundRecord);
    submitStepOne({
      nombreConductor: viajeData.conductor,
      placa: viajeData.placa,
      manifiesto: viajeData.manifiesto,
      clienteId: viajeData.clienteId,
      clienteNombre: viajeData.clienteNombre,
    });
  };

  // ── Items ya cargados vs pendientes ────────────────────────────────────────
  const itemsYaCargados =
    foundRecord?.items.filter((i) => i.entregado && i.processedImageUrl) ?? [];
  const itemsPendientes =
    foundRecord?.items.filter((i) => !i.entregado || !i.processedImageUrl) ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Datos del viaje</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ingrese el número de manifiesto para consultar la información del viaje.
        </p>
      </div>

      {/* Campo de manifiesto */}
      <div>
        <Input
          label="Número de manifiesto"
          placeholder="Ej. 456789"
          required
          value={manifiesto}
          onChange={(e) => setManifiesto(e.target.value)}
          autoComplete="off"
          inputMode="numeric"
        />

        {/* Indicador de búsqueda */}
        {estadoBusqueda === "buscando" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Consultando información del viaje…
          </p>
        )}

        {/* Error: no encontrado o falla de conexión */}
        {(estadoBusqueda === "no_encontrado" || estadoBusqueda === "error") && (
          <div className="mt-2 rounded-xl border-2 border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Datos autocompletados desde VIAJES */}
      {estadoBusqueda === "encontrado" && viajeData && (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-bold text-blue-800">Viaje encontrado</span>
          </div>

          {/* Info del viaje (read-only) */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <span className="text-gray-500">Conductor:</span>
            <span className="font-semibold text-gray-900">{viajeData.conductor}</span>
            <span className="text-gray-500">Placa:</span>
            <span className="font-semibold text-gray-900">{viajeData.placa}</span>
            <span className="text-gray-500">Cliente:</span>
            <span className="font-semibold text-gray-900 truncate">{viajeData.clienteNombre}</span>
          </div>

          {/* Banner registro existente (incompleto) */}
          {foundRecord && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <svg className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-xs font-bold text-amber-800">
                  {itemsPendientes.length === 0
                    ? "Este manifiesto ya tiene un registro completo"
                    : "Hay un registro incompleto para este manifiesto"}
                </p>
              </div>

              {itemsYaCargados.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {itemsYaCargados.map((i) => (
                    <span key={i.tipoDocumento} className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {LABELS_DOCUMENTO[i.tipoDocumento]}
                    </span>
                  ))}
                </div>
              )}

              {itemsPendientes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {itemsPendientes.map((i) => (
                    <span key={i.tipoDocumento} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {LABELS_DOCUMENTO[i.tipoDocumento]}
                    </span>
                  ))}
                  <span className="text-xs text-amber-700 self-center">pendientes</span>
                </div>
              )}

              {itemsPendientes.length === 0 ? (
                <div className="rounded-xl bg-green-50 border border-green-300 p-3 flex items-start gap-2">
                  <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-green-800">Todos los documentos ya han sido cargados</p>
                    <p className="text-xs text-green-700 mt-0.5">No hay documentos pendientes para este manifiesto.</p>
                  </div>
                </div>
              ) : (
                <>
                  <Button type="button" fullWidth onClick={handleCompleteExisting}>
                    Agregar documentos faltantes →
                  </Button>

                  <button
                    type="button"
                    className="text-xs text-center text-gray-400 underline hover:text-gray-600"
                    onClick={handleNuevoRegistro}
                  >
                    Crear nuevo registro de todos modos
                  </button>
                </>
              )}
            </div>
          )}

          {/* Sin registro existente: continuar directamente */}
          {!foundRecord && (
            <Button type="button" fullWidth onClick={handleNuevoRegistro}>
              Continuar →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
