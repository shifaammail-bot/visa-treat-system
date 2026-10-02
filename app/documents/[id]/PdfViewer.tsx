"use client";

import { useEffect, useRef, useState } from "react";

/* PDF.js is served from public/pdfjs (v4.10.38) so the bundler never touches it. */
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (o: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
    }>;
  };
};

/**
 * Draws the generated PDF onto the page with PDF.js, so it shows in every
 * browser — including Chrome set to download PDFs instead of opening them,
 * where an <iframe> stays blank. If the server can't make the PDF, the error
 * is shown instead of an empty area.
 */
export function PdfViewer({ src }: { src: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    message?: string;
  }>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(src, { cache: "no-store" });
        if (
          !res.ok ||
          !(res.headers.get("content-type") ?? "").includes("pdf")
        ) {
          const text = (await res.text()).slice(0, 600);
          throw new Error(
            `The server couldn't produce the PDF (${res.status}). ${text}`,
          );
        }
        const data = await res.arrayBuffer();

        const pdfjs = (await import(
          /* webpackIgnore: true */ "/pdfjs/pdf.min.mjs" as string
        )) as PdfJs;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled || !holder.current) return;

        holder.current.innerHTML = "";
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.min(holder.current.clientWidth, 900);

        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * ratio;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
          canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
          canvas.className =
            "mx-auto mb-4 block border border-navy/10 bg-white shadow-sm";
          holder.current.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("This browser can't draw the PDF.");
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
        }
        setState({ status: "ready" });
      } catch (e) {
        if (!cancelled)
          setState({ status: "error", message: (e as Error).message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="px-4 py-6">
      {state.status === "loading" && (
        <p className="py-20 text-center text-sm text-navy/50">
          Preparing the PDF…
        </p>
      )}
      {state.status === "error" && (
        <div className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">The PDF couldn&apos;t be shown.</p>
          <p className="mt-1 whitespace-pre-wrap break-words">
            {state.message}
          </p>
        </div>
      )}
      <div ref={holder} />
    </div>
  );
}
