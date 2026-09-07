/*
 * "Bounce". original waiting mini-game for the scanning screen.
 * You're a grade pill hopping over red rejection blocks. Tap / click /
 * space to jump. Score = how long you last. Runner mechanics only , 
 * all art is ours (brand shapes + oklch palette), nothing copyrighted.
 * Works on touch (mobile) and keyboard (desktop).
 */
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";

const GROUND_H = 24;
const GRAVITY = 2200;
const JUMP_VY = -760;

export function MiniGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("pg:bounce-best") || 0);
    } catch {
      return 0;
    }
  });
  const stateRef = useRef({ running: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c2d: CanvasRenderingContext2D = ctx;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    c2d.scale(dpr, dpr);

    let raf = 0;
    let last = 0;
    let y = 0; // pill offset above ground (px, positive = up)
    let vy = 0;
    let speed = 170; // gentle start. easy first 10 seconds hooks people
    let elapsed = 0;
    let obstacles: { x: number; w: number; h: number }[] = [];
    let nextGap = 0;
    let dead = false;

    const groundY = H - GROUND_H;
    const pillX = 34;
    const pillW = 30;
    const pillH = 22;

    function reset() {
      y = 0;
      vy = 0;
      speed = 170;
      elapsed = 0;
      obstacles = [];
      nextGap = 0;
      dead = false;
      setScore(0);
    }

    function jump() {
      if (!stateRef.current.running) return;
      if (y <= 0.5) vy = JUMP_VY;
    }

    function isTyping(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      return Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable));
    }

    function onKey(e: KeyboardEvent) {
      if (isTyping(e)) return; // never steal keys from a text field (Ask Nic, etc.)
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    }
    function onPointer() {
      jump();
    }

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointer);

    function frame(t: number) {
      if (!last) last = t;
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      if (stateRef.current.running && !dead) {
        elapsed += dt;
        speed += dt * 9;
        setScore(Math.floor(elapsed * 10));

        // physics: vy positive = falling, jump sets it negative
        vy += GRAVITY * dt;
        y -= vy * dt;
        if (y < 0) {
          y = 0;
          vy = 0;
        }

        // obstacles
        nextGap -= speed * dt;
        if (nextGap <= 0) {
          const h = 14 + Math.random() * 20;
          obstacles.push({ x: W + 20, w: 12 + Math.random() * 10, h });
          nextGap = 200 + Math.random() * 240;
        }
        obstacles.forEach((o) => (o.x -= speed * dt));
        obstacles = obstacles.filter((o) => o.x + o.w > -10);

        // collision
        for (const o of obstacles) {
          const pillBottom = groundY - y;
          if (pillX + pillW - 6 > o.x && pillX + 6 < o.x + o.w && pillBottom > groundY - o.h) {
            dead = true;
            stateRef.current.running = false;
            setRunning(false);
            setBest((b) => {
              const nb = Math.max(b, Math.floor(elapsed * 10));
              try {
                localStorage.setItem("pg:bounce-best", String(nb));
              } catch {}
              return nb;
            });
          }
        }
      }

      // draw
      c2d.clearRect(0, 0, W, H);
      // ground
      c2d.fillStyle = "oklch(0.9 0.03 80)";
      c2d.fillRect(0, groundY, W, 2);
      // obstacles (rejection blocks)
      c2d.fillStyle = "oklch(0.62 0.19 25)";
      obstacles.forEach((o) => {
        c2d.beginPath();
        c2d.roundRect(o.x, groundY - o.h, o.w, o.h, 3);
        c2d.fill();
      });
      // the grade pill (idle bob so the game visibly "breathes" before play)
      const idleBob = !stateRef.current.running && !dead ? Math.sin(t / 300) * 6 : 0;
      const py = groundY - y - pillH - Math.max(0, idleBob);
      const grad = c2d.createLinearGradient(pillX, py, pillX + pillW, py + pillH);
      grad.addColorStop(0, "oklch(0.86 0.14 60)");
      grad.addColorStop(1, "oklch(0.92 0.11 95)");
      c2d.fillStyle = grad;
      c2d.beginPath();
      c2d.roundRect(pillX, py, pillW, pillH, 11);
      c2d.fill();
      c2d.fillStyle = "oklch(0.3 0.05 55)";
      c2d.font = "700 12px Manrope, sans-serif";
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";
      c2d.fillText("A+", pillX + pillW / 2, py + pillH / 2 + 0.5);

      if (!stateRef.current.running) {
        c2d.fillStyle = "oklch(0.45 0.03 60)";
        c2d.font = "600 12px Manrope, sans-serif";
        c2d.fillText(dead ? "Rejected! Tap to retry" : "Tap or press space to play", W / 2, H / 2 - 8);
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const startHandler = () => {
      if (!stateRef.current.running) {
        track("game_started", {});
        reset();
        stateRef.current.running = true;
        setRunning(true);
      }
    };
    canvas.addEventListener("pointerdown", startHandler);
    const keyStart = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.code === "Space" || e.code === "ArrowUp") && !stateRef.current.running) startHandler();
    };
    window.addEventListener("keydown", keyStart);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", keyStart);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointerdown", startHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          <span
            className={running ? "hidden" : "inline-flex animate-pulse items-center rounded-full px-2 py-0.5 text-[10px] font-bold"}
            style={{ background: "linear-gradient(120deg, oklch(0.86 0.14 60), oklch(0.92 0.11 95))", color: "oklch(0.25 0.05 55)" }}
          >
            ▶ PLAY WHILE YOU WAIT
          </span>
          Bounce
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {score} · best {best}
        </p>
      </div>
      <canvas
        ref={canvasRef}
        className="mt-3 h-[170px] w-full cursor-pointer touch-none rounded-2xl border border-white/60 bg-white/50"
        aria-label={running ? "Bounce mini game, playing" : "Bounce mini game, tap to start"}
      />
      <p className="mt-2 text-[11px] text-muted-foreground">
        Tap or press space to jump the rejections. Your audit keeps running either way.
      </p>
    </div>
  );
}
