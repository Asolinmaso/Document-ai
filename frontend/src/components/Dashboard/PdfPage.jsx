import React, { memo } from 'react';

/** One page of a pdf.js document drawn on a canvas of the given CSS size. */
const PdfPage = memo(({ pdfDoc, pageNum, width, height }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!pdfDoc) return;
    let renderTask = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const viewport = page.getViewport({ scale: 1.0 });
        const scaleX = (width * dpr) / viewport.width;
        const scaleY = (height * dpr) / viewport.height;
        const transform = [scaleX, 0, 0, scaleY, 0, 0];

        context.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
          transform: transform
        });
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException' && err.message !== 'Rendering cancelled, closed or replaced') {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, width, height]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
});

PdfPage.displayName = 'PdfPage';

export default PdfPage;
