"use client";

import { useEffect, useRef, useState } from "react";
import { createProgram, type GLContext } from "@/lib/webgl/glUtils";
import { FRAGMENT_SHADER_SOURCE, FULLSCREEN_QUAD_VERTICES, VERTEX_SHADER_SOURCE } from "@/lib/webgl/ambientShaders";
import { VENUE } from "@/config/venue";
import type { Rgb } from "@/lib/ambientPalette";
import AmbientBackground from "./AmbientBackground";

// /display runs unattended for hours on a projector/mini-PC — retina pixel
// density buys nothing a viewer standing across a room would notice, and
// directly costs fragment-shader fillrate on modest GPUs.
const MAX_DEVICE_PIXEL_RATIO = 1.5;

// Single multiplier on the shader's u_time — the one knob to turn if the
// motion reads as too slow/fast on the actual projector, without touching
// GLSL. Tuned toward meditative drift rather than busy motion.
const AMBIENT_SPEED = 0.45;

// Burst intensity/position. Position is a static screen-space constant (the
// whole page is authored against one fixed 1920x1080 design canvas — see
// DisplayScreen's DESIGN_WIDTH docblock) approximating the Now Playing
// vinyl disc's center, in the canvas's upper-right quadrant. x/y are 0-1,
// matching the vertex shader's vUv convention (y=1 is the top).
const BURST_STRENGTH = 1.0;
const BURST_CENTER: [number, number] = [0.8, 0.72];

function toUnitFloat(channel: number): number {
  return channel / 255;
}

// WebGL/GLSL layered mesh-gradient version of AmbientBackground — see
// lib/webgl/ambientShaders.ts for the 4-layer structure. Brand/base colors
// come from config/venue.ts's `rgb` values as uniforms (u_brandColor/
// u_baseColor), not baked into the shader, so re-skinning for a different
// DJ/venue never touches this file or the GLSL source. `palette` is
// accepted here solely to forward to the CSS fallback if WebGL turns out to
// be unavailable; the GL canvas itself never reads it.
export default function AmbientBackgroundGL({
  palette = [],
  transitionVersion,
}: {
  palette?: Rgb[];
  // Same single-source-of-truth value driving DisplayCard's enter/exit
  // animation and EqualizerBars' burst — see DisplayScreen's
  // transitionVersion docblock. Bumping it triggers the shader burst below
  // by writing burstTimeRef only; it never tears down or recreates the GL
  // context/program/buffers.
  transitionVersion: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [restoreGeneration, setRestoreGeneration] = useState(0);
  const startTimeRef = useRef(0);
  const burstTimeRef = useRef(-1000);
  const hasMountedBurstRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as GLContext | null;
    if (!gl) {
      queueMicrotask(() => setWebglUnavailable(true));
      return;
    }

    let program: WebGLProgram;
    try {
      program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
    } catch {
      queueMicrotask(() => setWebglUnavailable(true));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_VERTICES, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const speedLocation = gl.getUniformLocation(program, "u_speed");
    const brandColorLocation = gl.getUniformLocation(program, "u_brandColor");
    const baseColorLocation = gl.getUniformLocation(program, "u_baseColor");
    const burstTimeLocation = gl.getUniformLocation(program, "u_burstTime");
    const burstStrengthLocation = gl.getUniformLocation(program, "u_burstStrength");
    const burstCenterLocation = gl.getUniformLocation(program, "u_burstCenter");
    // Constant for the program's lifetime, so set once here rather than
    // every frame alongside u_time/u_resolution.
    gl.uniform1f(speedLocation, AMBIENT_SPEED);
    gl.uniform3f(
      brandColorLocation,
      toUnitFloat(VENUE.rgb.accent[0]),
      toUnitFloat(VENUE.rgb.accent[1]),
      toUnitFloat(VENUE.rgb.accent[2])
    );
    gl.uniform3f(
      baseColorLocation,
      toUnitFloat(VENUE.rgb.background[0]),
      toUnitFloat(VENUE.rgb.background[1]),
      toUnitFloat(VENUE.rgb.background[2])
    );
    gl.uniform1f(burstStrengthLocation, BURST_STRENGTH);
    gl.uniform2f(burstCenterLocation, BURST_CENTER[0], BURST_CENTER[1]);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let rafId = 0;
    const startTime = performance.now();
    startTimeRef.current = startTime;
    burstTimeRef.current = -1000;
    const render = (now: number) => {
      const t = (now - startTime) / 1000;
      gl.uniform1f(timeLocation, t);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(burstTimeLocation, burstTimeRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    // Without preventDefault() here, the browser treats the loss as
    // permanent and 'webglcontextrestored' never fires — fatal for a page
    // meant to stay up all night.
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(rafId);
    };
    const handleContextRestored = () => {
      setRestoreGeneration((generation) => generation + 1);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      cancelAnimationFrame(rafId);
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
    };
  }, [restoreGeneration]);

  // Fires the burst by writing burstTimeRef only — no interaction with the
  // GL context/program/buffers above, so this can run as often as
  // transitionVersion changes without any setup/teardown cost.
  useEffect(() => {
    if (!hasMountedBurstRef.current) {
      hasMountedBurstRef.current = true;
      return;
    }
    burstTimeRef.current = (performance.now() - startTimeRef.current) / 1000;
  }, [transitionVersion]);

  if (webglUnavailable) {
    return <AmbientBackground palette={palette} />;
  }

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
