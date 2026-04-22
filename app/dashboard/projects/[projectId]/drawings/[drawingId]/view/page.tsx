import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params:
    | Promise<{
        projectId: string;
        drawingId: string;
      }>
    | {
        projectId: string;
        drawingId: string;
      };
};

type ProjectRow = {
  id: string;
};

type DrawingRow = {
  id: string;
  name: string;
  file_path: string;
};

function fileExt(path: string): string {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx + 1);
}

export default async function DrawingViewerPage({ params }: PageProps) {
  const { projectId, drawingId } = params instanceof Promise ? await params : params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: projectData } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectData as ProjectRow | null;
  if (!project) {
    redirect("/dashboard/projects");
  }

  const { data: drawingData } = await supabase
    .from("drawings")
    .select("id, name, file_path")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();
  const drawing = drawingData as DrawingRow | null;
  if (!drawing) {
    redirect(`/dashboard/projects/${projectId}`);
  }

  const { data: signed } = await supabase.storage.from("drawings").createSignedUrl(drawing.file_path, 60 * 30);
  if (!signed?.signedUrl) {
    redirect(`/dashboard/projects/${projectId}?error=Kunne+ikke+laste+tegning`);
  }

  const ext = fileExt(drawing.file_path);
  const isPdf = ext === "pdf";
  const webPdfViewerUrl = isPdf
    ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(signed.signedUrl)}`
    : null;

  return (
    <main className="h-[calc(100dvh-3.8rem)] p-2 sm:p-3">
      <section className="h-full min-h-[420px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 sm:min-h-[520px]">
        {isPdf ? (
          <div className="h-full w-full">
            <iframe src={webPdfViewerUrl ?? signed.signedUrl} title={`Tegning ${drawing.name}`} className="h-full w-full" />
            <div className="border-t border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-400">
              Hvis PDF ikke vises riktig:{" "}
              <a href={signed.signedUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-100">
                åpne direkte
              </a>
              .
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center overflow-auto bg-zinc-800 p-3">
            <img src={signed.signedUrl} alt={drawing.name} className="max-h-full max-w-full rounded border bg-white object-contain" />
          </div>
        )}
      </section>
    </main>
  );
}
