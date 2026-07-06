(function registerLayerExtractorController(globalObject) {
class LayerExtractorController {
  constructor({ root, getPreviewCanvas }) {
    this.root = root;
    this.getPreviewCanvas = getPreviewCanvas;

    this.layers = {
      hair: { id: "hair", label: "Hair", color: "rgba(246, 90, 77, 0.45)" },
      face: { id: "face", label: "Face", color: "rgba(77, 166, 255, 0.45)" },
      clothing: { id: "clothing", label: "Clothing", color: "rgba(121, 209, 107, 0.45)" }
    };

    this.state = {
      sourceImageData: null,
      width: 0,
      height: 0,
      activeLayerId: "hair",
      brushSize: 16,
      mode: "paint",
      pointerDown: false,
      layerMasks: {}
    };

    this.elements = {
      panel: root.querySelector("#extractor-panel"),
      sourceFile: root.querySelector("#extractor-source-file"),
      usePreview: root.querySelector("#extractor-use-preview"),
      activeLayer: root.querySelector("#extractor-active-layer"),
      brushSize: root.querySelector("#extractor-brush-size"),
      brushValue: root.querySelector("#extractor-brush-value"),
      modePaint: root.querySelector("#extractor-mode-paint"),
      modeErase: root.querySelector("#extractor-mode-erase"),
      clearLayer: root.querySelector("#extractor-clear-layer"),
      exportCurrent: root.querySelector("#extractor-export-current"),
      exportAll: root.querySelector("#extractor-export-all"),
      canvas: root.querySelector("#extractor-canvas"),
      zoom: root.querySelector("#extractor-zoom"),
      status: root.querySelector("#extractor-status")
    };
  }

  initialize() {
    if (!this.elements.panel || !this.elements.canvas) {
      return;
    }

    this.populateLayerSelect();
    this.elements.brushValue.textContent = String(this.state.brushSize);
    this.syncModeButtons();
    this.bindInputs();
    this.setStatus("Load an image or use current preview to start extraction.");
  }

  populateLayerSelect() {
    this.elements.activeLayer.innerHTML = Object.values(this.layers)
      .map((layer) => `<option value="${layer.id}">${layer.label}</option>`)
      .join("");

    this.elements.activeLayer.value = this.state.activeLayerId;
  }

  bindInputs() {
    this.elements.sourceFile.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        this.setStatus("Please choose a valid image file.");
        return;
      }

      this.setStatus(`Loading ${file.name}...`);

      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        this.loadSourceFromImage(image, "Loaded source from file.");
        URL.revokeObjectURL(objectUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        this.setStatus("Could not decode that image file. Try PNG or JPEG.");
      };
      image.src = objectUrl;

      // Allow selecting the same file again and still triggering change.
      this.elements.sourceFile.value = "";
    });

    this.elements.usePreview.addEventListener("click", () => {
      const previewCanvas = this.getPreviewCanvas ? this.getPreviewCanvas() : null;
      if (!previewCanvas) {
        this.setStatus("Preview canvas is unavailable.");
        return;
      }

      this.loadSourceFromCanvas(previewCanvas, "Loaded source from live preview.");
    });

    this.elements.activeLayer.addEventListener("change", () => {
      this.state.activeLayerId = this.elements.activeLayer.value;
      this.redrawCanvas();
    });

    this.elements.brushSize.addEventListener("input", () => {
      this.state.brushSize = Number(this.elements.brushSize.value);
      this.elements.brushValue.textContent = String(this.state.brushSize);
    });

    this.elements.modePaint.addEventListener("click", () => {
      this.state.mode = "paint";
      this.syncModeButtons();
    });

    this.elements.modeErase.addEventListener("click", () => {
      this.state.mode = "erase";
      this.syncModeButtons();
    });

    this.elements.clearLayer.addEventListener("click", () => {
      if (!this.hasSource()) {
        return;
      }

      const mask = this.state.layerMasks[this.state.activeLayerId];
      mask.fill(0);
      this.redrawCanvas();
      this.setStatus(`Cleared ${this.layers[this.state.activeLayerId].label} mask.`);
    });

    this.elements.exportCurrent.addEventListener("click", () => {
      this.exportLayer(this.state.activeLayerId);
    });

    this.elements.exportAll.addEventListener("click", () => {
      Object.keys(this.layers).forEach((layerId) => this.exportLayer(layerId));
    });

    this.elements.zoom.addEventListener("input", () => {
      const zoom = Number(this.elements.zoom.value);
      this.elements.canvas.style.width = `${this.state.width * zoom}px`;
      this.elements.canvas.style.height = `${this.state.height * zoom}px`;
    });

    this.elements.canvas.addEventListener("pointerdown", (event) => {
      if (!this.hasSource()) {
        return;
      }

      this.state.pointerDown = true;
      this.applyBrush(event);
    });

    this.elements.canvas.addEventListener("pointermove", (event) => {
      if (!this.state.pointerDown || !this.hasSource()) {
        return;
      }

      this.applyBrush(event);
    });

    window.addEventListener("pointerup", () => {
      this.state.pointerDown = false;
    });
  }

  syncModeButtons() {
    const paintActive = this.state.mode === "paint";
    this.elements.modePaint.classList.toggle("active", paintActive);
    this.elements.modeErase.classList.toggle("active", !paintActive);
  }

  hasSource() {
    return Boolean(this.state.sourceImageData);
  }

  loadSourceFromImage(image, statusText) {
    try {
      const bufferCanvas = document.createElement("canvas");
      bufferCanvas.width = image.width;
      bufferCanvas.height = image.height;
      const bufferCtx = bufferCanvas.getContext("2d");

      if (!bufferCtx) {
        this.setStatus("Unable to prepare canvas for image extraction.");
        return;
      }

      bufferCtx.drawImage(image, 0, 0);
      this.loadImageData(bufferCtx.getImageData(0, 0, image.width, image.height), statusText);
    } catch {
      this.setStatus("Image loaded, but pixel data could not be read.");
    }
  }

  loadSourceFromCanvas(canvas, statusText) {
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        this.setStatus("Could not read preview canvas data.");
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.loadImageData(imageData, statusText);
    } catch {
      this.setStatus("Preview canvas is protected. Use Source Image upload instead.");
    }
  }

  loadImageData(imageData, statusText) {
    this.state.sourceImageData = imageData;
    this.state.width = imageData.width;
    this.state.height = imageData.height;

    this.elements.canvas.width = imageData.width;
    this.elements.canvas.height = imageData.height;
    this.elements.canvas.style.width = `${imageData.width * Number(this.elements.zoom.value)}px`;
    this.elements.canvas.style.height = `${imageData.height * Number(this.elements.zoom.value)}px`;

    this.state.layerMasks = {};
    Object.keys(this.layers).forEach((layerId) => {
      this.state.layerMasks[layerId] = new Uint8Array(imageData.width * imageData.height);
    });

    this.syncModeButtons();
    this.redrawCanvas();
    this.setStatus(statusText);
  }

  applyBrush(event) {
    const pos = this.getCanvasPixelPosition(event);
    if (!pos) {
      return;
    }

    const { x, y } = pos;
    const radius = Math.max(1, Math.floor(this.state.brushSize / 2));
    const radiusSq = radius * radius;
    const mask = this.state.layerMasks[this.state.activeLayerId];
    const targetValue = this.state.mode === "paint" ? 1 : 0;

    const minX = Math.max(0, x - radius);
    const minY = Math.max(0, y - radius);
    const maxX = Math.min(this.state.width - 1, x + radius);
    const maxY = Math.min(this.state.height - 1, y + radius);

    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const dx = px - x;
        const dy = py - y;
        if (dx * dx + dy * dy > radiusSq) {
          continue;
        }

        mask[py * this.state.width + px] = targetValue;
      }
    }

    this.redrawCanvas();
  }

  getCanvasPixelPosition(event) {
    const rect = this.elements.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    const x = Math.floor(((event.clientX - rect.left) / rect.width) * this.state.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * this.state.height);

    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) {
      return null;
    }

    return { x, y };
  }

  redrawCanvas() {
    if (!this.hasSource()) {
      return;
    }

    const ctx = this.elements.canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.putImageData(this.state.sourceImageData, 0, 0);

    Object.values(this.layers).forEach((layer) => {
      const mask = this.state.layerMasks[layer.id];
      const parsedColor = this.parseRgba(layer.color);

      // Draw only selected mask pixels so unselected areas keep original source image.
      ctx.fillStyle = `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, ${parsedColor.a / 255})`;
      for (let i = 0; i < mask.length; i += 1) {
        if (mask[i] !== 1) {
          continue;
        }

        const px = i % this.state.width;
        const py = Math.floor(i / this.state.width);
        ctx.fillRect(px, py, 1, 1);
      }
    });
  }

  parseRgba(rgbaText) {
    const matches = rgbaText
      .replace("rgba(", "")
      .replace(")", "")
      .split(",")
      .map((part) => part.trim());

    return {
      r: Number(matches[0] || 0),
      g: Number(matches[1] || 0),
      b: Number(matches[2] || 0),
      a: Math.round(Number(matches[3] || 0) * 255)
    };
  }

  exportLayer(layerId) {
    if (!this.hasSource()) {
      this.setStatus("Load a source image before exporting.");
      return;
    }

    const mask = this.state.layerMasks[layerId];
    let selectedCount = 0;
    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i] === 1) {
        selectedCount += 1;
      }
    }

    if (selectedCount === 0) {
      this.setStatus(`No pixels selected for ${this.layers[layerId].label}.`);
      return;
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = this.state.width;
    outCanvas.height = this.state.height;
    const outCtx = outCanvas.getContext("2d");

    const source = this.state.sourceImageData.data;
    const output = outCtx.createImageData(this.state.width, this.state.height);

    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i] !== 1) {
        continue;
      }

      const pixelOffset = i * 4;
      output.data[pixelOffset] = source[pixelOffset];
      output.data[pixelOffset + 1] = source[pixelOffset + 1];
      output.data[pixelOffset + 2] = source[pixelOffset + 2];
      output.data[pixelOffset + 3] = source[pixelOffset + 3];
    }

    outCtx.putImageData(output, 0, 0);

    const download = document.createElement("a");
    download.href = outCanvas.toDataURL("image/png");
    download.download = `extracted_${layerId}.png`;
    download.click();

    this.setStatus(`Exported ${this.layers[layerId].label} as PNG.`);
  }

  setStatus(message) {
    this.elements.status.textContent = message;
  }
}

globalObject.JRPG.systems.extractor.LayerExtractorController = LayerExtractorController;
})(window);
