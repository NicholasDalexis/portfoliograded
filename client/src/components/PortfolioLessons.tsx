import { useEffect, useId, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortfolioLessonArtwork,
  type PortfolioLessonVisual,
} from "./portfolioLessonArtwork";

type PortfolioLesson = {
  id: PortfolioLessonVisual;
  title: string;
  body: string;
  caption: string;
  imageDescription: string;
};

/** Advice adapted from Nic's six held, private portfolio-advice drafts. */
const LESSONS: readonly PortfolioLesson[] = [
  {
    id: "positioning",
    title: "Say what you do, right up front.",
    body: "Name the work you want to do and who you make it for. A clear role helps someone understand your portfolio before they open a project.",
    caption: "Fictional homepage example",
    imageDescription:
      "The vague headline ‘Creative thinker’ is replaced with ‘Social media strategist for fashion brands.’",
  },
  {
    id: "contribution",
    title: "Show the part that was yours.",
    body: "Beside a team project, name your role, a decision you made and what you delivered. A class project can show good work. Just say that it was one.",
    caption: "Fictional class project example",
    imageDescription:
      "A class project is annotated with ‘My role: Copywriter’ and ‘My part: Launch emails.’",
  },
  {
    id: "mobile",
    title: "Give your own phone a turn.",
    body: "Tap a project, read its caption without zooming and try your contact link. A desktop preview cannot tell you how the whole visit feels on your phone.",
    caption: "An illustrated check to try yourself",
    imageDescription:
      "A phone diagram shows three actions: tap a project, read its caption and try contact. These are instructions, not completed checks.",
  },
  {
    id: "readability",
    title: "Make the story easy to read.",
    body: "Read your captions at normal zoom. Give body text room and enough contrast with the background. Keep the decorative font for a heading.",
    caption: "Illustrative grades, not your report",
    imageDescription:
      "An example tier list shows First impression at A, Positioning at B and Text readability at C. Readability is circled as the next improvement.",
  },
  {
    id: "selection",
    title: "Lead with your next role in mind.",
    body: "Put the project that best shows the work you want to do first, even if it is not the newest. Add a clear title and one sentence explaining the work.",
    caption: "Fictional project order",
    imageDescription:
      "A stack of project cards has ‘Relevant to my next role’ moved to the first position.",
  },
  {
    id: "contact",
    title: "Give the visit a clear next step.",
    body: "Put a contact link near your introduction and after your work. ‘Email me’ is a useful label. Try the link yourself, then ask a friend to find it.",
    caption: "An illustrated contact path",
    imageDescription:
      "An arrow leads from ‘Your work’ to an ‘Email me’ button, with a reminder to test the link.",
  },
];

/**
 * Rotate only during a scan, without simulating review progress. Reading,
 * navigation, reduced motion and background tabs pause the rotation. Keep the
 * component mounted when a report finishes so the current lesson stays put.
 */
export function PortfolioLessons({
  className,
  scanning = false,
}: {
  className?: string;
  scanning?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const id = useId();

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateVisibility();
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      preference.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const rotating =
    scanning && !paused && !hovered && !focused && !hidden && !reducedMotion;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(
      () => setIndex(current => (current + 1) % LESSONS.length),
      8_000
    );
    return () => window.clearTimeout(timer);
  }, [rotating, index]);

  function step(direction: number) {
    setPaused(true);
    setIndex(
      current => (current + direction + LESSONS.length) % LESSONS.length
    );
  }

  return (
    <section
      className={cn("@container min-w-0 py-2", className)}
      aria-labelledby={`${id}-heading`}
      data-portfolio-lessons
      data-rotating={rotating}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 id={`${id}-heading`} className="pg-brand-eyebrow">
          Portfolio notes
        </h2>
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-xs text-muted-foreground"
            aria-label={`Lesson ${index + 1} of ${LESSONS.length}`}
          >
            {index + 1} of {LESSONS.length}
          </span>
          {scanning && !reducedMotion && (
            <button
              type="button"
              className="pg-action-secondary px-3 text-sm"
              aria-pressed={paused}
              aria-label={
                paused ? "Play portfolio notes" : "Pause portfolio notes"
              }
              onClick={() => setPaused(current => !current)}
            >
              {paused ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" aria-hidden="true" />
              )}
              {paused ? "Play" : "Pause"}
            </button>
          )}
        </div>
      </div>

      {/* Shared grid cell retains the tallest lesson's space at every width.
        Hidden cards cannot receive focus and are absent from the a11y tree. */}
      <div className="grid" id={`${id}-lessons`}>
        {LESSONS.map((lesson, lessonIndex) => (
          <article
            key={lesson.id}
            className={cn(
              "col-start-1 row-start-1 grid min-w-0 content-start gap-5 py-6 @2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @2xl:items-center @2xl:gap-8",
              lessonIndex !== index && "invisible pointer-events-none"
            )}
            aria-hidden={lessonIndex !== index}
            inert={lessonIndex !== index}
            aria-labelledby={`${id}-${lesson.id}-title`}
            data-lesson={lesson.id}
          >
            <figure className="min-w-0">
              <div className="mx-auto max-w-[300px]">
                <PortfolioLessonArtwork visual={lesson.id} />
              </div>
              <figcaption className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
                {lesson.caption}
                <span className="sr-only">. {lesson.imageDescription}</span>
              </figcaption>
            </figure>
            <div className="min-w-0">
              <h3
                id={`${id}-${lesson.id}-title`}
                className="font-display text-2xl font-bold leading-tight sm:text-3xl"
              >
                {lesson.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {lesson.body}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
        <button
          type="button"
          className="pg-action-secondary min-w-0 px-3"
          aria-label="Previous portfolio lesson"
          aria-controls={`${id}-lessons`}
          onClick={() => step(-1)}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          className="pg-action-secondary min-w-0 px-3"
          aria-label="Next portfolio lesson"
          aria-controls={`${id}-lessons`}
          onClick={() => step(1)}
        >
          Next
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-6 border-t border-foreground/10 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-xl font-bold">
            When your grade lands
          </h3>
          <a
            href="/how-to"
            className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            See how to use it{" "}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <ol className="mt-2 grid gap-4 text-sm leading-relaxed sm:grid-cols-3">
          <li>
            <span className="font-semibold text-amber-900">
              01 · Open a category
            </span>
            <p className="mt-1 text-muted-foreground">
              See what worked and what to fix.
            </p>
          </li>
          <li>
            <span className="font-semibold text-amber-900">
              02 · Compare both views
            </span>
            <p className="mt-1 text-muted-foreground">
              Check the previews, then try your site on your own phone.
            </p>
          </li>
          <li>
            <span className="font-semibold text-amber-900">
              03 · Make one change
            </span>
            <p className="mt-1 text-muted-foreground">
              Edit your site, then check the fix off. Re-grade when you’re
              ready.
            </p>
          </li>
        </ol>
      </div>
      <p
        className="sr-only"
        aria-live={rotating ? "off" : "polite"}
        aria-atomic="true"
      >
        Lesson {index + 1} of {LESSONS.length}: {LESSONS[index].title}
      </p>
    </section>
  );
}
