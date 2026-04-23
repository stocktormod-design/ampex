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
    <div className="fixed inset-0 z-[70] overflow-hidden bg-zinc-950">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex items-center p-2 sm:p-3">
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-3 text-sm text-zinc-100 shadow-lg backdrop-blur hover:bg-zinc-800"
        >
          <span aria-hidden>←</span>
          <span>Tilbake</span>
        </Link>
      </div>
      <div className="h-full w-full">{children}</div>
    </div>
  );
}
