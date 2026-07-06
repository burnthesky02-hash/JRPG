(function registerPreviewRenderer(globalObject) {
const imageCache = new Map();
const canvasRenderVersions = new WeakMap();

function drawWeapon(ctx, classId) {
  ctx.save();
  ctx.translate(145, 152);

  switch (classId) {
    case "vanguard":
      ctx.fillStyle = "#5b4b3a";
      ctx.fillRect(-3, -26, 6, 36);
      ctx.fillStyle = "#bfc8ce";
      ctx.fillRect(-13, -32, 26, 8);
      break;
    case "arcanist":
      ctx.fillStyle = "#7f5e42";
      ctx.fillRect(-2, -28, 4, 38);
      ctx.fillStyle = "#53b3ff";
      ctx.beginPath();
      ctx.arc(0, -34, 7, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "ranger":
      ctx.strokeStyle = "#6f513f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -16, 14, Math.PI * 0.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    default:
      ctx.fillStyle = "#67768a";
      ctx.fillRect(-8, -20, 16, 20);
      ctx.fillStyle = "#f3f7fa";
      ctx.fillRect(-4, -26, 8, 8);
      break;
  }

  ctx.restore();
}

function drawBackdrop(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, "#c2efff");
  gradient.addColorStop(1, "#fdf2d7");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 220, 260);

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(40 + i * 40, 30 + (i % 2) * 16, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function getBodyImage(assetPath) {
  if (!assetPath) {
    return Promise.resolve(null);
  }

  if (imageCache.has(assetPath)) {
    return imageCache.get(assetPath);
  }

  const imagePromise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = assetPath;
  });

  imageCache.set(assetPath, imagePromise);
  return imagePromise;
}

function getLayerImage(assetPath) {
  if (!assetPath) {
    return Promise.resolve(null);
  }

  if (imageCache.has(assetPath)) {
    return imageCache.get(assetPath);
  }

  const imagePromise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = assetPath;
  });

  imageCache.set(assetPath, imagePromise);
  return imagePromise;
}

function drawFallbackBody(ctx) {
  ctx.save();
  ctx.translate(112, 154);
  ctx.fillStyle = "#f8d9bc";
  ctx.beginPath();
  ctx.arc(0, -48, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d0b090";
  ctx.fillRect(-24, -30, 48, 72);
  ctx.restore();
}

function drawBodyLayer(ctx, characterLike) {
  const bodyImage = characterLike.appearance._bodyImage;
  if (!bodyImage) {
    drawFallbackBody(ctx);
    return;
  }

  ctx.drawImage(bodyImage, 44, 28, 132, 190);
}

function drawClothingLayer(ctx, clothingId, primaryColor, accentColor, clothingImage) {
  if (clothingImage) {
    ctx.drawImage(clothingImage, 44, 28, 132, 190);
    return;
  }

  ctx.save();
  ctx.translate(112, 154);

  if (clothingId === "armor") {
    ctx.fillStyle = "#8b949e";
    ctx.fillRect(-28, -24, 56, 58);
    ctx.fillStyle = accentColor;
    ctx.fillRect(-28, -24, 56, 14);
  } else if (clothingId === "mystic") {
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(-30, -28);
    ctx.lineTo(30, -28);
    ctx.lineTo(44, 46);
    ctx.lineTo(-44, 46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.fillRect(-10, -22, 20, 62);
  } else {
    ctx.fillStyle = primaryColor;
    ctx.fillRect(-28, -26, 56, 60);
    ctx.fillStyle = accentColor;
    ctx.fillRect(-28, -26, 56, 12);
  }

  ctx.restore();
}

function drawFaceLayer(ctx, faceId) {
  ctx.save();
  ctx.translate(112, 102);
  ctx.fillStyle = "#2b2730";

  if (faceId === "fierce") {
    ctx.fillRect(-10, -2, 4, 2);
    ctx.fillRect(6, -2, 4, 2);
    ctx.fillRect(-8, 8, 16, 2);
  } else if (faceId === "cheerful") {
    ctx.fillRect(-8, 0, 3, 3);
    ctx.fillRect(5, 0, 3, 3);
    ctx.beginPath();
    ctx.arc(0, 8, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = "#2b2730";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillRect(-8, -1, 3, 3);
    ctx.fillRect(5, -1, 3, 3);
    ctx.fillRect(-4, 8, 8, 2);
  }

  ctx.restore();
}

function drawHairLayer(ctx, hairId, accentColor, hairImage) {
  if (hairImage) {
    ctx.drawImage(hairImage, 44, 28, 132, 190);
    return;
  }

  ctx.save();
  ctx.translate(112, 82);
  ctx.fillStyle = accentColor;

  if (hairId === "long") {
    ctx.fillRect(-24, -6, 48, 12);
    ctx.fillRect(-24, 6, 10, 34);
    ctx.fillRect(14, 6, 10, 34);
  } else if (hairId === "spiked") {
    ctx.beginPath();
    ctx.moveTo(-26, 8);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-2, -14);
    ctx.lineTo(6, 8);
    ctx.lineTo(14, -10);
    ctx.lineTo(22, 8);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-22, -2, 44, 10);
  }

  ctx.restore();
}

function drawCharacterName(ctx, characterLike) {
  ctx.fillStyle = "rgba(17, 32, 47, 0.82)";
  ctx.font = "bold 14px Trebuchet MS";
  ctx.fillText(characterLike.name || "Unnamed", 12, 232);
  ctx.font = "12px Trebuchet MS";
  ctx.fillText(`${characterLike.species.label} ${characterLike.class.label}`, 12, 248);
}

function renderCompositedCharacter(canvas, characterLike) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  drawBackdrop(ctx);
  drawBodyLayer(ctx, characterLike);
  drawClothingLayer(
    ctx,
    characterLike.appearance.layers.clothing.id,
    characterLike.appearance.primaryColor,
    characterLike.appearance.accentColor,
    characterLike.appearance.layers.clothing._image
  );
  drawFaceLayer(ctx, characterLike.appearance.layers.face.id);
  drawHairLayer(
    ctx,
    characterLike.appearance.layers.hair.id,
    characterLike.appearance.accentColor,
    characterLike.appearance.layers.hair._image
  );
  drawWeapon(ctx, characterLike.class.id);
  drawCharacterName(ctx, characterLike);
}

function resolveClothingAssetPath(characterLike) {
  const clothingLayer = characterLike.appearance.layers.clothing;
  const bodyTypeId = characterLike.appearance.bodyType.id;

  return (
    clothingLayer.assetPathByBodyType?.[bodyTypeId] ||
    clothingLayer.assetPath ||
    null
  );
}

function renderCharacterPreview(canvas, characterLike) {
  const nextVersion = (canvasRenderVersions.get(canvas) || 0) + 1;
  canvasRenderVersions.set(canvas, nextVersion);
  const bodyAssetPath = characterLike.appearance.bodyType?.assetPath;

  const clothingAssetPath = resolveClothingAssetPath(characterLike);
  const hairAssetPath = characterLike.appearance.layers.hair?.assetPath || null;

  Promise.all([
    getBodyImage(bodyAssetPath),
    getLayerImage(clothingAssetPath),
    getLayerImage(hairAssetPath)
  ]).then(([bodyImage, clothingImage, hairImage]) => {
    if (canvasRenderVersions.get(canvas) !== nextVersion) {
      return;
    }

    const viewModel = {
      ...characterLike,
      appearance: {
        ...characterLike.appearance,
        _bodyImage: bodyImage,
        layers: {
          ...characterLike.appearance.layers,
          clothing: {
            ...characterLike.appearance.layers.clothing,
            _image: clothingImage
          },
          hair: {
            ...characterLike.appearance.layers.hair,
            _image: hairImage
          }
        }
      }
    };

    renderCompositedCharacter(canvas, viewModel);
  });
}

globalObject.JRPG.rendering.renderCharacterPreview = renderCharacterPreview;
})(window);
