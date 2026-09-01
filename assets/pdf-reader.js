(() => {
  "use strict";

  const config = window.JACOB_PDF_READER;
  const container = document.querySelector("#pdf-document");
  const progress = document.querySelector("#pdf-reader-progress");
  const errorBox = document.querySelector("#pdf-reader-error");
  const download = document.querySelector("#pdf-reader-download");

  function finish() {
    document.dispatchEvent(new CustomEvent("jacob:content-ready"));
  }

  async function renderDocument() {
    if (!config?.pdfUrl || !container) {
      errorBox.hidden = false;
      errorBox.textContent = "This PDF link is not valid.";
      progress.textContent = "Document unavailable";
      finish();
      return;
    }

    download.href = config.pdfUrl;

    try {
      const pdfjs = await import(config.pdfModule);
      pdfjs.GlobalWorkerOptions.workerSrc = config.pdfWorker;
      const pdf = await pdfjs.getDocument({ url: config.pdfUrl }).promise;
      progress.textContent = `Rendering ${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}…`;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const naturalViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.min(container.clientWidth || 900, 900);
        const scale = Math.min(1.5, availableWidth / naturalViewport.width);
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        const pageElement = document.createElement("section");
        pageElement.className = "pdf-page";
        pageElement.setAttribute("aria-label", `Page ${pageNumber}`);
        pageElement.style.width = `${viewport.width}px`;
        pageElement.style.height = `${viewport.height}px`;

        const canvas = document.createElement("canvas");
        canvas.className = "pdf-page-canvas";
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        pageElement.appendChild(canvas);

        const textLayer = document.createElement("div");
        textLayer.className = "textLayer";
        textLayer.style.setProperty("--total-scale-factor", String(viewport.scale));
        pageElement.appendChild(textLayer);
        container.appendChild(pageElement);

        const transform = outputScale !== 1
          ? [outputScale, 0, 0, outputScale, 0, 0]
          : null;
        await page.render({
          canvasContext: canvas.getContext("2d", { alpha: false }),
          transform,
          viewport,
        }).promise;

        const textContent = await page.getTextContent({ includeMarkedContent: true });
        const selectableLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport,
        });
        await selectableLayer.render();
        progress.textContent = `Rendered page ${pageNumber} of ${pdf.numPages}`;
      }

      progress.textContent = `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}`;
    } catch (error) {
      console.error(error);
      errorBox.hidden = false;
      errorBox.textContent = "The PDF could not be rendered. You can still open the original file.";
      progress.textContent = "Document unavailable";
    } finally {
      finish();
    }
  }

  renderDocument();
})();
