// Export a rendered quote as PNG or PDF in the browser. Both libraries are
// imported on demand, so they never load until someone clicks Download.

async function snapshot(node: HTMLElement) {
  const { toPng } = await import("html-to-image");
  // Wait for the logo and fonts so the export matches what's on screen.
  await document.fonts?.ready;
  await Promise.all(
    [...node.querySelectorAll("img")].map((img) =>
      img.complete ? null : img.decode().catch(() => null),
    ),
  );
  return toPng(node, { pixelRatio: 2, backgroundColor: "#f4f2ef", cacheBust: true });
}

function fileName(base: string, ext: string) {
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "quote";
  return `hq360-${slug}.${ext}`;
}

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadQuoteImage(node: HTMLElement, title: string) {
  download(await snapshot(node), fileName(title, "png"));
}

/** A4 PDF; long quotes continue onto further pages. */
export async function downloadQuotePdf(node: HTMLElement, title: string) {
  const [dataUrl, { jsPDF }] = await Promise.all([snapshot(node), import("jspdf")]);
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (img.height * pageW) / img.width;
  let offset = 0;
  pdf.addImage(dataUrl, "PNG", 0, 0, pageW, imgH, undefined, "FAST");
  while (imgH - offset > pageH + 1) {
    offset += pageH;
    pdf.addPage();
    pdf.addImage(dataUrl, "PNG", 0, -offset, pageW, imgH, undefined, "FAST");
  }
  pdf.save(fileName(title, "pdf"));
}
