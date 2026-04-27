"use client";

import { useRef } from "react";
import { NativeInput } from "@/components/ui/native-input";
import { SubmitButton } from "@/components/ui/submit-button";

type DisciplineOption = { id: string; label: string };

type Props = {
  showUpload: boolean;
  defaultQ: string;
  defaultDisc: string;
  disciplineOptions: readonly DisciplineOption[];
};

export function DrawingSearchFilterForm({
  showUpload,
  defaultQ,
  defaultDisc,
  disciplineOptions,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="flex flex-wrap gap-2">
      {showUpload && <input type="hidden" name="new" value="1" />}
      <NativeInput
        name="q"
        defaultValue={defaultQ}
        placeholder="Søk i tegninger..."
        className="flex-1 min-w-[160px]"
      />
      <select
        name="disc"
        defaultValue={defaultDisc}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Alle fagområder</option>
        {disciplineOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <SubmitButton variant="outline" className="shrink-0">
        Søk
      </SubmitButton>
    </form>
  );
}
