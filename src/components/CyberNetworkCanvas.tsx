import { useEffect, useRef } from "react";

type Particle = {
  x: number; y: number; vx: number; vy: number; radius: number; phase: number;
};

export default function CyberNetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !layer || !context) return;

    const ctx = context;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 680px)");
    const pointer = { x: -1000, y: -1000, active: false };
    let width = 1;
    let height = 1;
    let dpr = 1;
    let particles: Particle[] = [];
    let frame = 0;
    let lastTime = 0;
    let elapsed = 0;
    let paused = document.hidden;
    let disposed = false;

    const random = (min: number, max: number) => min + Math.random() * (max - min);

    const resize = () => {
      const rect = layer.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, mobileQuery.matches ? 1.25 : 1.6);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = reducedMotion.matches ? 0 : mobileQuery.matches ? 28 : Math.min(76, Math.max(44, Math.round(width / 17)));
      particles = Array.from({ length: count }, () => ({
        x: random(0, width), y: random(0, height * 0.88),
        vx: random(-0.22, 0.22), vy: random(-0.18, 0.18),
        radius: random(1, 2.1), phase: random(0, Math.PI * 2),
      }));
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      drawStatic();
      if (!reducedMotion.matches && !paused) frame = window.requestAnimationFrame(draw);
    };

    const drawGrid = () => {
      const horizon = height * 0.68;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, width, height - horizon);
      ctx.clip();
      const vanishX = width * 0.5;
      const vanishY = horizon;
      for (let i = -12; i <= 12; i++) {
        const bottomX = vanishX + i * width * 0.115;
        ctx.beginPath();
        ctx.moveTo(vanishX, vanishY);
        ctx.lineTo(bottomX, height + 2);
        ctx.strokeStyle = "rgba(0, 178, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let i = 1; i <= 12; i++) {
        const progress = i / 12;
        const y = horizon + (height - horizon) * progress * progress;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.strokeStyle = `rgba(0, 178, 255, ${0.025 + progress * 0.055})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const fade = ctx.createLinearGradient(0, horizon, 0, height);
      fade.addColorStop(0, "rgba(7, 11, 22, 0)");
      fade.addColorStop(1, "rgba(7, 11, 22, .96)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, horizon, width, height - horizon);
      ctx.restore();
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      drawGrid();
    };

    const draw = (time: number) => {
      if (disposed || paused) return;
      const delta = lastTime ? Math.min(2, (time - lastTime) / 16.67) : 1;
      lastTime = time;
      elapsed += delta;
      ctx.clearRect(0, 0, width, height);
      drawGrid();

      const reach = mobileQuery.matches ? 108 : 148;
      for (let i = 0; i < particles.length; i++) {
        const node = particles[i];
        if (pointer.active) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          if (distance < 175) {
            const force = (175 - distance) / 175;
            node.vx += (dx / distance) * force * 0.018;
            node.vy += (dy / distance) * force * 0.018;
          }
        }
        node.vx = Math.max(-0.52, Math.min(0.52, node.vx * 0.997));
        node.vy = Math.max(-0.46, Math.min(0.46, node.vy * 0.997));
        node.x += node.vx * delta;
        node.y += node.vy * delta;
        if (node.x < -8 || node.x > width + 8) node.vx *= -1;
        if (node.y < -8 || node.y > height * 0.9) node.vy *= -1;
        node.phase += 0.018 * delta;

        for (let j = i + 1; j < particles.length; j++) {
          const other = particles[j];
          const distance = Math.hypot(node.x - other.x, node.y - other.y);
          if (distance >= reach) continue;
          const proximity = 1 - distance / reach;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(0, 242, 255, ${0.035 + proximity * 0.28})`;
          ctx.lineWidth = 0.45 + proximity * 1.15;
          ctx.stroke();
        }

        if (pointer.active) {
          const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
          if (distance < 190) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.strokeStyle = `rgba(124, 58, 237, ${(1 - distance / 190) * 0.58})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        const glow = 0.55 + Math.sin(node.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + glow * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 242, 255, ${glow})`;
        ctx.shadowColor = "#00f2ff";
        ctx.shadowBlur = mobileQuery.matches ? 4 : 9;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Low-intensity data pulse rings radiate from the centre emblem.
      const pulsePeriod = 210;
      const pulse = (elapsed % pulsePeriod) / pulsePeriod;
      for (let ring = 0; ring < 2; ring++) {
        const progress = (pulse + ring * 0.5) % 1;
        const radius = 16 + progress * Math.min(width, height) * 0.56;
        ctx.beginPath();
        ctx.arc(width * 0.72, height * 0.48, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 242, 255, ${(1 - progress) * 0.11})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      frame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = layer.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        pointer.active = false;
        return;
      }
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = event.pointerType !== "touch";
    };
    const onPointerLeave = () => { pointer.active = false; };
    const onVisibility = () => {
      paused = document.hidden;
      if (paused) {
        window.cancelAnimationFrame(frame);
      } else {
        lastTime = 0;
        if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
      }
    };
    const onScroll = () => {
      const rect = layer.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
      layer.style.setProperty("--hud-scroll", `${progress * 16}px`);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(layer);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    mobileQuery.addEventListener("change", resize);
    reducedMotion.addEventListener("change", resize);
    resize();

    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      mobileQuery.removeEventListener("change", resize);
      reducedMotion.removeEventListener("change", resize);
    };
  }, []);

  return (
    <div className="cyber-network-layer" ref={layerRef} aria-hidden="true">
      <canvas ref={canvasRef} className="cyber-network-canvas" />
      <div className="cyber-network-vignette" />
      <div className="cyber-network-hud cyber-network-hud-top">
        <span>SYS / 01</span><span>NETWORK ACTIVE · ENCRYPTED CHANNEL</span>
      </div>
      <div className="cyber-network-hud cyber-network-hud-bottom">
        <span>SRN · 34.0837° N / 74.7973° E</span><span>NODE FIELD // LIVE VISUAL</span>
      </div>
      <span className="cyber-network-hex cyber-network-hex-one">⌬</span>
      <span className="cyber-network-hex cyber-network-hex-two">⌬</span>
    </div>
  );
}
