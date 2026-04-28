"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { importReceiptText } from "./actions";

type Props = {
  defaultSupplierName: string;
};

export function ReceiptImportPanel({ defaultSupplierName }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState("");
  const [supplierName, setSupplierName] = useState(defaultSupplierName);

  const estimatedLines = useMemo(() => {
    return receiptText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0).length;
  }, [receiptText]);

  const onPaste: React.ClipboardEventHandler<HTMLDivElement> = (event) => {
    const items = event.clipboardData?.items ?? [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          setImagePreview(typeof reader.result === "string" ? reader.result : null);
        };
        reader.readAsDataURL(file);
        event.preventDefault();
        return;
      }
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold">Les og eksporter</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Ta screenshot av ordrekvittering (Print Screen), gå hit og trykk Ctrl+V.
        Lim også inn tekstlinjer fra kvitteringen hvis mulig for automatisk import.
      </p>

      <div
        onPaste={onPaste}
        className="rounded-lg border border-dashed border-border bg-muted/20 p-4"
      >
        <p className="text-sm font-medium">Paste-sone</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Klikk her og trykk Ctrl+V for å lime inn screenshot.
        </p>

        {imagePreview ? (
          <div className="mt-3">
            <img
              src={imagePreview}
              alt="Kvittering preview"
              className="max-h-64 rounded-md border border-border object-contain"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Ingen screenshot limt inn ennå.</p>
        )}
      </div>

      <form action={importReceiptText} className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Leverandør</p>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            {["Elektroimportøren", "Ahlsell", "Onninen", "Solar"].map((supplier) => (
              <button
                key={supplier}
                type="button"
                onClick={() => setSupplierName(supplier)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  supplierName === supplier
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {supplier}
              </button>
            ))}
          </div>
          <input type="hidden" name="supplier_name" value={supplierName} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="receipt_supplier_name" className="text-xs font-medium text-muted-foreground">
            Valgt leverandør
          </label>
          <input
            id="receipt_supplier_name"
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            placeholder="f.eks. Elektroimportøren"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>

        <div className="space-y-1 sm:col-span-4">
          <label htmlFor="receipt_text" className="text-xs font-medium text-muted-foreground">
            Kvitteringstekst
          </label>
          <textarea
            id="receipt_text"
            name="receipt_text"
            rows={8}
            value={receiptText}
            onChange={(event) => setReceiptText(event.target.value)}
            placeholder="Lim inn tekst fra ordrekvittering. En varelinje per linje."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
          <p className="text-xs text-muted-foreground">
            Estimerte linjer: {estimatedLines}
          </p>
        </div>

        <div className="sm:col-span-4">
          <SubmitButton>Importer til regnskap</SubmitButton>
        </div>
      </form>
    </div>
  );
}

