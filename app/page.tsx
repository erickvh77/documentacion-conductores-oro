import { FormProvider } from "@/lib/context/FormContext";
import { FormShell } from "@/components/form/FormShell";

export default function Home() {
  return (
    <FormProvider>
      <FormShell />
    </FormProvider>
  );
}
