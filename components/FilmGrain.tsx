"use client";

import { useEffect, useRef } from "react";

const FilmGrain = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    let width = 0;
    let height = 0;
    let pixelWidth = 0;
    let pixelHeight = 0;
    let dpr = 1;
    const grainScale = 2;

    let imageData: ImageData | null = null;
    let pixels: Uint8ClampedArray | null = null;
    let temporal: Float32Array | null = null;
    let noiseWidth = 0;
    let noiseHeight = 0;

    const seedTemporal = () => {
      if (!temporal) return;
      for (let i = 0; i < temporal.length; i++) {
        temporal[i] = Math.random();
      }
    };

    const setupBuffers = () => {
      if (pixelWidth === 0 || pixelHeight === 0) {
        imageData = null;
        pixels = null;
        temporal = null;
        noiseWidth = 0;
        noiseHeight = 0;
        return;
      }

      noiseWidth = Math.max(1, Math.round(pixelWidth / grainScale));
      noiseHeight = Math.max(1, Math.round(pixelHeight / grainScale));

      offscreen.width = noiseWidth;
      offscreen.height = noiseHeight;
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.imageSmoothingEnabled = false;

      imageData = offCtx.createImageData(noiseWidth, noiseHeight);
      pixels = imageData.data;
      temporal = new Float32Array(noiseWidth * noiseHeight);
      seedTemporal();
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      pixelWidth = Math.round(width * dpr);
      pixelHeight = Math.round(height * dpr);

      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;

      setupBuffers();
    };

    resize();
    window.addEventListener("resize", resize);

    let frameId: number;
    let lastTime = 0;
    const fpsInterval = 1000 / 20;

    const drawFrame = (timestamp: number) => {
      frameId = requestAnimationFrame(drawFrame);
      if (!imageData || !pixels || !temporal) return;
      if (timestamp - lastTime < fpsInterval) return;
      lastTime = timestamp;

      const pixelCount = temporal.length;
      for (let i = 0; i < pixelCount; i++) {
        const randomSample = Math.random();
        temporal[i] = temporal[i] * 0.6 + randomSample * 0.4;
        const centered = temporal[i] - 0.5;
        const value = 128 + centered * 90;
        const offset = i * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
        pixels[offset + 3] = 120;
      }

      offCtx.putImageData(imageData, 0, 0);

      ctx.clearRect(0, 0, pixelWidth, pixelHeight);
      ctx.globalAlpha = 1;
      ctx.drawImage(offscreen, 0, 0, noiseWidth, noiseHeight, 0, 0, pixelWidth, pixelHeight);
    };

    frameId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} data-film-grain="true" />;
};

export default FilmGrain;
