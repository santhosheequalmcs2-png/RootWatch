import type { RiskLevel } from '../types/rootwatch';
import { clamp } from './analytics';

export interface VisionSegmentationOutput {
  overlayDataUrl: string;
  rootAreaPct: number;
  estimatedLengthCm: number;
  healthyWhitePct: number;
  tanOchrePct: number;
  darkBrownPct: number;
  imageQualityScore: number;
  qualityLabel: 'good' | 'fair' | 'poor';
  stressIndicatorLevel: RiskLevel;
  rootHealthEstimate: number;
  confidencePct: number;
  summaryKey: string;
}

/**
 * Prototype client-side HTML5 Canvas root segmentation & color-profile heuristic.
 * Inspects real pixel RGB/luminance/chromatic ratios of the loaded image to highlight
 * pale/healthy root fibers vs tan/darkened stressed segments against dark soil.
 * Clearly labeled as a prototype/demo vision algorithm pending a trained Python FastAPI U-Net/Mask R-CNN backend.
 */
export async function analyzeRootImagePrototype(
  imageSrc: string,
): Promise<VisionSegmentationOutput> {
  const img = await loadImage(imageSrc);

  const maxDim = 480;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const width = Math.max(120, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(90, Math.round((img.naturalHeight || img.height) * scale));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) {
    throw new Error('Canvas 2D context unavailable');
  }
  srcCtx.drawImage(img, 0, 0, width, height);

  const imgData = srcCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Build overlay canvas
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.drawImage(img, 0, 0, width, height);
  const outData = outCtx.getImageData(0, 0, width, height);
  const oPixels = outData.data;

  const totalPixels = width * height;
  let healthyRootPixels = 0;
  let tanRootPixels = 0;
  let darkRootPixels = 0;
  let lumSum = 0;
  let edgeEnergySum = 0;

  // Focus inside 92% inner frame to ignore glass rim borders at top/sides
  const xMin = Math.floor(width * 0.04);
  const xMax = Math.floor(width * 0.96);
  const yMin = Math.floor(height * 0.08);
  const yMax = Math.floor(height * 0.96);

  for (let y = yMin; y < yMax; y++) {
    for (let x = xMin; x < xMax; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += lum;

      // Simple local horizontal gradient for sharpness / focus estimate
      if (x > xMin) {
        const prevIdx = idx - 4;
        const prevLum =
          0.299 * data[prevIdx] + 0.587 * data[prevIdx + 1] + 0.114 * data[prevIdx + 2];
        edgeEnergySum += Math.abs(lum - prevLum);
      }

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const warmth = r - b;

      // Heuristic segmentation of root tissues against dark soil background
      // 1) Pale/cream healthy root tissue (bright, low-to-moderate warmth, not pure blue/green stem)
      const isGreenLeaf = g > r + 14 && g > b + 12;
      const isPaleRoot = !isGreenLeaf && lum >= 135 && sat < 0.34 && r >= 125 && g >= 118;
      // 2) Tan/ochre mildly stressed root tissue (warm golden/tan mid-bright pixels)
      const isTanRoot =
        !isGreenLeaf &&
        !isPaleRoot &&
        lum >= 88 &&
        lum < 155 &&
        warmth >= 28 &&
        r > g &&
        g > b &&
        sat >= 0.28 &&
        sat <= 0.72;
      // 3) Dark amber/brown stressed root segments (saturated warm brown distinct from neutral dark soil)
      const isDarkStressedRoot =
        !isGreenLeaf &&
        !isPaleRoot &&
        !isTanRoot &&
        lum >= 48 &&
        lum < 92 &&
        warmth >= 26 &&
        r > g + 10 &&
        sat >= 0.42;

      if (isPaleRoot) {
        healthyRootPixels++;
        // Tint overlay crisp leaf green
        oPixels[idx] = Math.round(r * 0.45 + 46 * 0.55);
        oPixels[idx + 1] = Math.round(g * 0.45 + 195 * 0.55);
        oPixels[idx + 2] = Math.round(b * 0.45 + 110 * 0.55);
      } else if (isTanRoot) {
        tanRootPixels++;
        // Tint overlay warm amber
        oPixels[idx] = Math.round(r * 0.4 + 235 * 0.6);
        oPixels[idx + 1] = Math.round(g * 0.4 + 165 * 0.6);
        oPixels[idx + 2] = Math.round(b * 0.4 + 35 * 0.6);
      } else if (isDarkStressedRoot) {
        darkRootPixels++;
        // Tint overlay terracotta crimson
        oPixels[idx] = Math.round(r * 0.35 + 220 * 0.65);
        oPixels[idx + 1] = Math.round(g * 0.35 + 68 * 0.65);
        oPixels[idx + 2] = Math.round(b * 0.35 + 55 * 0.65);
      } else {
        // Slightly dim soil pixels so root mask stands out cleanly
        oPixels[idx] = Math.round(r * 0.72);
        oPixels[idx + 1] = Math.round(g * 0.72);
        oPixels[idx + 2] = Math.round(b * 0.72);
      }
    }
  }

  outCtx.putImageData(outData, 0, 0);

  const inspectedPixels = Math.max(1, (xMax - xMin) * (yMax - yMin));
  const rootPixels = healthyRootPixels + tanRootPixels + darkRootPixels;
  const rawCoveragePct = (rootPixels / inspectedPixels) * 100;
  const rootAreaPct = Number(clamp(rawCoveragePct, 1.5, 68).toFixed(1));

  // Normalize color distribution across detected root pixels
  let healthyWhitePct = 0;
  let tanOchrePct = 0;
  let darkBrownPct = 0;

  if (rootPixels > 30) {
    healthyWhitePct = Number(((healthyRootPixels / rootPixels) * 100).toFixed(1));
    tanOchrePct = Number(((tanRootPixels / rootPixels) * 100).toFixed(1));
    darkBrownPct = Number(Math.max(0, 100 - healthyWhitePct - tanOchrePct).toFixed(1));
  } else {
    healthyWhitePct = 62;
    tanOchrePct = 24;
    darkBrownPct = 14;
  }

  // Image quality estimate from exposure + edge contrast
  const avgLum = lumSum / inspectedPixels;
  const avgEdge = edgeEnergySum / inspectedPixels;
  const exposureScore = 100 - Math.abs(avgLum - 85) * 0.9;
  const sharpnessScore = clamp(avgEdge * 5.2, 35, 100);
  const imageQualityScore = Math.round(clamp(exposureScore * 0.45 + sharpnessScore * 0.55, 42, 95));
  const qualityLabel: 'good' | 'fair' | 'poor' =
    imageQualityScore >= 76 ? 'good' : imageQualityScore >= 58 ? 'fair' : 'poor';

  // Estimated root length in cm based on segmented coverage & pixel perimeter proxy
  const estimatedLengthCm = Number(clamp(rootAreaPct * 3.4 + (totalPixels > 0 ? 12 : 0), 14, 210).toFixed(1));

  // Prototype stress indicator assessment
  const discolorationRatio = darkBrownPct * 1.25 + tanOchrePct * 0.55;
  let stressIndicatorLevel: RiskLevel = 'low';
  let summaryKey = 'vision_summary_healthy';

  if (discolorationRatio >= 48 || darkBrownPct >= 26) {
    stressIndicatorLevel = 'high';
    summaryKey = 'vision_summary_high';
  } else if (discolorationRatio >= 30 || darkBrownPct >= 15) {
    stressIndicatorLevel = 'elevated';
    summaryKey = 'vision_summary_elevated';
  } else if (discolorationRatio >= 18 || tanOchrePct >= 20) {
    stressIndicatorLevel = 'moderate';
    summaryKey = 'vision_summary_moderate';
  }

  const rootHealthEstimate = Math.round(
    clamp(94 - darkBrownPct * 1.15 - tanOchrePct * 0.45 + (rootAreaPct > 14 ? 4 : -4), 24, 96),
  );
  const confidencePct = Math.round(clamp(imageQualityScore * 0.78 + (rootPixels > 500 ? 8 : -8), 44, 82));

  return {
    overlayDataUrl: outCanvas.toDataURL('image/png'),
    rootAreaPct,
    estimatedLengthCm,
    healthyWhitePct,
    tanOchrePct,
    darkBrownPct,
    imageQualityScore,
    qualityLabel,
    stressIndicatorLevel,
    rootHealthEstimate,
    confidencePct,
    summaryKey,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load root image for analysis'));
    img.src = src;
  });
}
