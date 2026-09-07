import type { ReactNode } from "react";

/**
 * Working adaptations of the six held portfolio-advice SVGs in Nic's private
 * Still Unemployed preview. Original geometry is retained; product type,
 * semantic colors and teaching labels are adapted for Portfolio Graded.
 * These are illustrations, never screenshots or findings from a review.
 */
export type PortfolioLessonVisual =
  | "positioning"
  | "contribution"
  | "mobile"
  | "readability"
  | "selection"
  | "contact";

const accent = "text-orange-700";
const wash = "oklch(0.9 0.11 85)";
const peach = "oklch(0.89 0.09 60)";
const paper = "var(--background)";

function Label({
  x,
  y,
  children,
  serif = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  serif?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      stroke="none"
      fill="currentColor"
      fontFamily={serif ? "var(--font-display)" : "var(--font-sans)"}
      fontSize={serif ? 29 : 20}
      fontWeight={serif ? 700 : 500}
    >
      {children}
    </text>
  );
}

export function PortfolioLessonArtwork({
  visual,
}: {
  visual: PortfolioLessonVisual;
}) {
  let drawing: ReactNode;
  switch (visual) {
    case "positioning":
      drawing = (
        <>
          <path d="M17 15 281 12l2 125-267 4 1-126Z" fill="var(--card)" />
          <path d="m18 15 263-3v20L18 35Z" fill={peach} />
          <path d="M18 35l263-3" />
          <circle cx="29" cy="24" r="2" />
          <circle cx="40" cy="24" r="2" />
          <circle cx="51" cy="24" r="2" />
          <Label x={34} y={65}>
            Creative thinker
          </Label>
          <path d="m28 66 190-13" className={accent} />
          <Label x={34} y={102}>
            Social media strategist
          </Label>
          <Label x={34} y={127}>
            for fashion brands
          </Label>
          <path d="M259 56q27 27-8 41m0 0 2-13m-2 13 13-4" className={accent} />
        </>
      );
      break;
    case "contribution":
      drawing = (
        <>
          <path d="m15 12 102 3-3 126-101-4 2-125Z" />
          <path d="m25 22 80 2-1 51-82-2 2-51Z" fill={wash} />
          <Label x={26} y={46}>
            Class
          </Label>
          <Label x={26} y={68}>
            project
          </Label>
          <path d="m25 91 58 2m-58 10 71 1m-70 11 47 1" />
          <Label x={140} y={35}>
            My role:
          </Label>
          <Label x={154} y={61}>
            Copywriter
          </Label>
          <Label x={140} y={95}>
            My part:
          </Label>
          <Label x={154} y={121}>
            Launch emails
          </Label>
          <path
            d="M123 49q8-12 15-8m-15 8 0-9m0 9 9-2M122 111q8-12 15-8m-15 8 0-9m0 9 9-2"
            className={accent}
          />
        </>
      );
      break;
    case "mobile":
      drawing = (
        <>
          <path
            d="M36 7 111 8q9 0 9 10l-1 126q0 9-9 9l-73-1q-8 0-8-9l1-125q0-11 6-11Z"
            fill={peach}
          />
          <path d="m53 17 39 1m-59 13 82 1m-83 101 82 1" />
          <circle cx="73" cy="143" r="3" />
          <path d="m42 44 60 1-1 44-60-1 1-44Z" fill={wash} />
          <path d="m44 101 54 1m-54 9 38 1" />
          <Label x={147} y={46}>
            Tap a project
          </Label>
          <Label x={147} y={84}>
            Read its caption
          </Label>
          <Label x={147} y={123}>
            Try contact
          </Label>
          <path
            d="m132 34 5 5 8-10m-13 43 5 5 8-10m-13 44 5 5 8-10"
            className={accent}
          />
        </>
      );
      break;
    case "readability":
      drawing = (
        <>
          <path d="m17 15 267-2 0 133-267 2 0-133Z" />
          <path d="m17 15 42 0v44H17Z" fill={wash} />
          <path d="m17 59 42 0v44H17Z" fill={peach} />
          <path d="m17 103 42 0v45H17Z" fill="oklch(0.85 0.055 45)" />
          <path d="m18 59 264-2m-264 46 264-2" />
          <Label x={28} y={47} serif>
            A
          </Label>
          <Label x={28} y={92} serif>
            B
          </Label>
          <Label x={28} y={136} serif>
            C
          </Label>
          <Label x={74} y={45}>
            First impression
          </Label>
          <Label x={74} y={89}>
            Positioning
          </Label>
          <Label x={74} y={131}>
            Text readability
          </Label>
          <path
            d="M72 109q97-17 190 0 22 19-8 31-87 17-181-1-15-9-1-30Z"
            className={accent}
          />
        </>
      );
      break;
    case "selection":
      drawing = (
        <>
          <path d="m35 40 218 3-2 96-218-3 2-96Z" fill={peach} />
          <path d="m27 25 218 5-3 96-218-3 3-98Z" fill={wash} />
          <path d="m18 11 216 4-2 95-217-4 3-95Z" fill={paper} />
          <Label x={35} y={47}>
            Relevant to my
          </Label>
          <Label x={35} y={76}>
            next role
          </Label>
          <path d="m36 83 151-2" stroke={wash} strokeWidth="7" />
          <path d="M259 125q53-32-3-92m0 0-2 16m2-16 16 6" className={accent} />
          <Label x={179} y={156}>
            Move it up
          </Label>
        </>
      );
      break;
    case "contact":
      drawing = (
        <>
          <path d="m13 13 108-1 0 72-110 1 2-72Z" />
          <path d="m23 28 81-1m-81 14 65 1m-64 14 76 0" />
          <Label x={28} y={77}>
            Your work
          </Label>
          <path d="M62 96q16 36 85 16m0 0-10-6m10 6-9 9" className={accent} />
          <path d="m155 64 127 1-1 67-128-1 2-67Z" fill={wash} />
          <Label x={181} y={108}>
            Email me
          </Label>
          <path d="m246 121 13 27 4-12 13-3-30-12Z" fill={paper} />
          <Label x={153} y={41}>
            Test this link
          </Label>
        </>
      );
      break;
  }
  return (
    <svg
      viewBox="0 0 300 166"
      aria-hidden="true"
      focusable="false"
      className="block h-auto w-full text-foreground"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawing}
      </g>
    </svg>
  );
}
