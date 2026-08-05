
"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN
// ─────────────────────────────────────────────────────────────────────────────

const launchDate = new Date("2026-09-14T08:00:00-03:00");
const pad = n => String(n).padStart(2,"0");

function updateCountdown(){
  const diff = launchDate.getTime() - Date.now();

  if(diff <= 0){
    ["days","hours","minutes","seconds"].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.textContent = "00";
    });
    document.title = "IZIDOC — Lançamento iniciado";
    return;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  document.getElementById("days").textContent = pad(days);
  document.getElementById("hours").textContent = pad(hours);
  document.getElementById("minutes").textContent = pad(minutes);
  document.getElementById("seconds").textContent = pad(seconds);

  document.title = `${days}d ${pad(hours)}h ${pad(minutes)}m — IZIDOC`;
}

updateCountdown();
setInterval(updateCountdown,1000);

// ─────────────────────────────────────────────────────────────────────────────
// KINETIC GRID — algoritmo oficial, com a paleta IZIDOC
// ─────────────────────────────────────────────────────────────────────────────

const canvas = document.getElementById("kineticGrid");

if (canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const ctx = canvas.getContext("2d");

  const CELL_SIZE = 55;
  const INFLUENCE_RADIUS = 260;
  const MAX_WARP = 24;
  const DOT_SPACING = 28;
  const LERP_SPEED = 0.08;

  const LINE_BASE = { r: 255, g: 0, b: 144, a: 0.13 };
  const LINE_ACTIVE = { r: 255, g: 10, b: 138, a: 0.90 };
  const NODE_BASE = { r: 255, g: 0, b: 144, a: 0.20 };
  const NODE_ACTIVE = { r: 255, g: 255, b: 255, a: 1.0 };

  const NODE_BASE_RADIUS = 1.8;
  const NODE_ACTIVE_RADIUS = 3.2;

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let raf = 0;

  const mouse = { x: -9999, y: -9999 };
  const targetMouse = { x: -9999, y: -9999 };
  const ripples = [];

  function lerpN(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(base, active, t) {
    const r = Math.round(lerpN(base.r, active.r, t));
    const g = Math.round(lerpN(base.g, active.g, t));
    const b = Math.round(lerpN(base.b, active.b, t));
    const a = lerpN(base.a, active.a, t);
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getWarpedPoint(gx, gy, col, row, cols, rows) {
    const edgeMargin = 1.5;

    const colPin = Math.min(
      col / edgeMargin,
      (cols - 1 - col) / edgeMargin,
      1,
    );

    const rowPin = Math.min(
      row / edgeMargin,
      (rows - 1 - row) / edgeMargin,
      1,
    );

    const pinFactor = colPin * colPin * rowPin * rowPin;

    const dx = gx - mouse.x;
    const dy = gy - mouse.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const proximity =
      Math.max(0, 1 - distance / INFLUENCE_RADIUS) * pinFactor;

    let rippleX = 0;
    let rippleY = 0;

    for (const ripple of ripples) {
      const rdx = gx - ripple.x;
      const rdy = gy - ripple.y;
      const rippleDistance = Math.sqrt(rdx * rdx + rdy * rdy);
      const waveWidth = 55;
      const difference = rippleDistance - ripple.radius;

      if (Math.abs(difference) < waveWidth) {
        const strength =
          (1 - Math.abs(difference) / waveWidth) *
          ripple.opacity *
          18 *
          pinFactor;

        const angle = Math.atan2(rdy, rdx);
        const sign = difference < 0 ? -1 : 1;

        rippleX += Math.cos(angle) * strength * sign * -1;
        rippleY += Math.sin(angle) * strength * sign * -1;
      }
    }

    if (
      distance < INFLUENCE_RADIUS &&
      distance > 0 &&
      pinFactor > 0
    ) {
      const t = distance / INFLUENCE_RADIUS;
      const eased =
        t < 0.01
          ? 0
          : (1 - t) * (1 - t) * Math.min(1, distance / 60);

      const warpAmount = eased * MAX_WARP * pinFactor;
      const angle = Math.atan2(dy, dx);

      return {
        point: {
          x: gx - Math.cos(angle) * warpAmount + rippleX,
          y: gy - Math.sin(angle) * warpAmount + rippleY,
        },
        proximity,
      };
    }

    return {
      point: {
        x: gx + rippleX,
        y: gy + rippleY,
      },
      proximity,
    };
  }

  function draw(now) {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,0,144,0.05)";

    for (let x = DOT_SPACING / 2; x < width; x += DOT_SPACING) {
      for (let y = DOT_SPACING / 2; y < height; y += DOT_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const ripple = ripples[index];
      const age = (now - ripple.born) / 1000;

      ripple.radius = Math.max(0, age * 400);
      ripple.opacity = Math.max(0, 1 - age * 1.2);

      if (ripple.opacity <= 0) {
        ripples.splice(index, 1);
      }
    }

    const cols = Math.max(2, Math.ceil(width / CELL_SIZE)) + 1;
    const rows = Math.max(2, Math.ceil(height / CELL_SIZE)) + 1;
    const cellWidth = width / (cols - 1);
    const cellHeight = height / (rows - 1);

    const points = [];
    const proximityMap = [];

    for (let row = 0; row < rows; row += 1) {
      points[row] = [];
      proximityMap[row] = [];

      for (let col = 0; col < cols; col += 1) {
        const warped = getWarpedPoint(
          col * cellWidth,
          row * cellHeight,
          col,
          row,
          cols,
          rows,
        );

        points[row][col] = warped.point;
        proximityMap[row][col] = warped.proximity;
      }
    }

    function drawSegment(pointA, pointB, proximityA, proximityB) {
      const average = (proximityA + proximityB) / 2;
      const smooth = average * average * (3 - 2 * average);

      ctx.beginPath();
      ctx.moveTo(pointA.x, pointA.y);
      ctx.lineTo(pointB.x, pointB.y);
      ctx.strokeStyle = lerpColor(LINE_BASE, LINE_ACTIVE, smooth);
      ctx.lineWidth = lerpN(0.8, 1.5, smooth);
      ctx.stroke();
    }

    ctx.lineCap = "butt";

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols - 1; col += 1) {
        drawSegment(
          points[row][col],
          points[row][col + 1],
          proximityMap[row][col],
          proximityMap[row][col + 1],
        );
      }
    }

    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rows - 1; row += 1) {
        drawSegment(
          points[row][col],
          points[row + 1][col],
          proximityMap[row][col],
          proximityMap[row + 1][col],
        );
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const point = points[row][col];
        const proximity = proximityMap[row][col];
        const smooth = proximity * proximity * (3 - 2 * proximity);

        const radius = lerpN(
          NODE_BASE_RADIUS,
          NODE_ACTIVE_RADIUS,
          smooth,
        );

        if (smooth > 0.3) {
          const glowRadius =
            radius + lerpN(0, 6, (smooth - 0.3) / 0.7);

          const gradient = ctx.createRadialGradient(
            point.x,
            point.y,
            radius * 0.5,
            point.x,
            point.y,
            glowRadius,
          );

          gradient.addColorStop(
            0,
            `rgba(255,0,144,${(smooth * 0.30).toFixed(3)})`,
          );

          gradient.addColorStop(1, "rgba(255,0,144,0)");

          ctx.beginPath();
          ctx.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = lerpColor(NODE_BASE, NODE_ACTIVE, smooth);
        ctx.fill();
      }
    }

    for (const ripple of ripples) {
      const safeRadius = Math.max(0, ripple.radius);

      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, safeRadius, 0, Math.PI * 2);
      ctx.strokeStyle =
        `rgba(255,0,144,${(ripple.opacity * 0.28).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function animate(now) {
    mouse.x = lerpN(mouse.x, targetMouse.x, LERP_SPEED);
    mouse.y = lerpN(mouse.y, targetMouse.y, LERP_SPEED);

    draw(now);
    raf = window.requestAnimationFrame(animate);
  }

  function onPointerMove(event) {
    targetMouse.x = event.clientX;
    targetMouse.y = event.clientY;
  }

  function onPointerDown(event) {
    ripples.push({
      x: event.clientX,
      y: event.clientY,
      radius: 0,
      opacity: 1,
      born: performance.now(),
    });
  }

  resizeCanvas();

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerdown", onPointerDown);

  raf = window.requestAnimationFrame(animate);
}
