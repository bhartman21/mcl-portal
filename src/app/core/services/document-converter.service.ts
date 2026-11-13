import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

@Injectable({ providedIn: 'root' })
export class DocumentConverterService {
  /**
   * Renders a page of an uploaded PDF file into a crisp PNG data URL.
   */
  async convertPdfToPng(
    file: File,
    pageNumber = 1
  ): Promise<{ pngDataUrl: string; pageCount: number }> {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const safePage = Math.max(1, Math.min(pageNumber, pdf.numPages));
    const page = await pdf.getPage(safePage);

    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to initialize canvas for PDF rendering.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    return {
      pngDataUrl: canvas.toDataURL('image/png'),
      pageCount: pdf.numPages,
    };
  }

  /**
   * Converts a Word (.docx) file into HTML via Mammoth and rasterizes it to a PNG data URL.
   */
  async convertDocxToPng(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '720px';
    container.style.minHeight = '480px';
    container.style.padding = '48px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#142c49';
    container.style.fontFamily = 'Georgia, "Times New Roman", serif';
    container.style.fontSize = '16px';
    container.style.lineHeight = '1.5';
    container.innerHTML = result.value || '<p>(Empty document)</p>';

    // Ensure embedded images inside the docx fit cleanly within the page width
    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => {
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    });

    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      return canvas.toDataURL('image/png');
    } finally {
      document.body.removeChild(container);
    }
  }

  /**
   * Downloads a PNG data URL to the user's device.
   */
  downloadPng(pngDataUrl: string, baseName: string): void {
    const clean = this.sanitizeBaseName(baseName);
    const link = document.createElement('a');
    link.href = pngDataUrl;
    link.download = `${clean}.png`;
    link.click();
  }

  /**
   * Wraps the ad artwork PNG into a sized PDF and downloads it.
   */
  downloadPdfFromPng(
    pngDataUrl: string,
    baseName: string,
    widthIn: number,
    heightIn: number
  ): void {
    const clean = this.sanitizeBaseName(baseName);
    const orientation = widthIn >= heightIn ? 'landscape' : 'portrait';
    const doc = new jsPDF({
      orientation,
      unit: 'in',
      format: [widthIn, heightIn],
    });

    doc.addImage(pngDataUrl, 'PNG', 0, 0, widthIn, heightIn);
    doc.save(`${clean}.pdf`);
  }

  private sanitizeBaseName(name: string): string {
    return (
      name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '') || 'mcl-ad'
    );
  }
}

