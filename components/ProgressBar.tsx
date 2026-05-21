"use client";

interface Step {
  number: 1 | 2 | 3;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: "Datos del viaje" },
  { number: 2, label: "Documentos" },
  { number: 3, label: "Confirmación" },
];

interface ProgressBarProps {
  currentStep: 1 | 2 | 3;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isUpcoming = currentStep < step.number;

          return (
            <div key={step.number} className="flex items-center flex-1">
              {/* Paso */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors",
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : "bg-gray-200 text-gray-500",
                  ].join(" ")}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={[
                    "text-xs font-medium leading-none text-center",
                    isCurrent ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>

              {/* Línea conectora */}
              {index < STEPS.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-2 mt-[-14px] rounded-full transition-colors",
                    isCompleted ? "bg-green-400" : "bg-gray-200",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
