import Link from "next/link";

type LayoutProps = {
  children: React.ReactNode;
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

export default async function DrawingFullscreenLayout({ children, params }: LayoutProps) {
  const { projectId } = params instanceof Promise ? await params : params;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-zinc-950">
      <header className="relative flex h-11 shrink-0 items-center border-b border-zinc-800 bg-zinc-950 px-3">
        <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="inline-flex h-8 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        >
          <span aria-hidden>←</span>
          <span>Tilbake</span>
        </Link>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
