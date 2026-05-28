/**
 * Chart export helpers: SVG → PNG and SVG → PDF.
 *
 * Works by serializing the SVG from a recharts container, drawing it
 * onto a canvas, and exporting the canvas as a PNG blob. PDF wraps the
 * rasterized image via jspdf.
 */

import { jsPDF } from 'jspdf';

function getSvgFromContainer(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('svg.recharts-surface');
}

function svgToCanvas(svg: SVGSVGElement, scale = 2): Promise<HTMLCanvasElement> {
  // eslint-disable-next-line promise/avoid-new -- wraps event-based image decoding; no async equivalent
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const { width, height } = svg.getBoundingClientRect();

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context unavailable'));
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = () => { reject(new Error('Failed to render SVG to image')); };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  });
}

export async function exportChartPng(container: HTMLElement, filename: string): Promise<void> {
  const svg = getSvgFromContainer(container);
  if (!svg) throw new Error('No recharts SVG found in container');
  const canvas = await svgToCanvas(svg);
  // eslint-disable-next-line promise/avoid-new -- wraps canvas.toBlob callback API
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => { b ? resolve(b) : reject(new Error('toBlob failed')); }, 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportChartPdf(container: HTMLElement, filename: string, title?: string): Promise<void> {
  const svg = getSvgFromContainer(container);
  if (!svg) throw new Error('No recharts SVG found in container');
  const canvas = await svgToCanvas(svg, 2);
  const imgData = canvas.toDataURL('image/png');
  const { width, height } = svg.getBoundingClientRect();

  // eslint-disable-next-line new-cap -- jsPDF is the library's canonical export name
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width + 40, height + (title ? 60 : 40)],
  });

  if (title) {
    pdf.setFontSize(14);
    pdf.text(title, 20, 24);
  }

  pdf.addImage(imgData, 'PNG', 20, title ? 40 : 20, width, height);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
