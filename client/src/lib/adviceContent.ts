/*
 * Nested "what does this actually mean" advice per category.
 * Shown as an expandable inside each InsightCard so the report never
 * overwhelms, but the how-to is one tap away. Grounded in the rubric doc
 * (Rasputin/JobHunt/Portfolio-Graded-Rubrics.md) + Nic's own lessons from
 * the Google fellowship portfolio review.
 */
import type { CategoryKey } from "@shared/audit";

export interface AdviceBlock {
  meaning: string;
  steps: string[];
  template?: string;
}

export const ADVICE: Record<CategoryKey, AdviceBlock> = {
  first_impression: {
    meaning:
      "A recruiter gives your hero about 5 seconds. If they can't tell who you are, what you make, and why to keep scrolling, they don't.",
    steps: [
      "One H1 that names you + the work you want (not just your name).",
      "Put your single strongest proof point in the hero, not below the fold.",
      "One visible next step: contact, resume, or work. pick a primary.",
    ],
  },
  narrative: {
    meaning:
      "Your site should read like a person with a point of view, not a slideshow. Positioning = the role you want, said plainly, backed by receipts.",
    steps: [
      "Write one positioning paragraph: the work you want + your approach + one real result or lesson.",
      "Name the job title you want. Recruiters search titles, not vibes.",
      "Cut anything that could appear on anyone else's portfolio unchanged.",
    ],
  },
  case_studies: {
    meaning:
      "A case study is NOT a 12-page deep dive. It's a scannable card: the problem, your role, the approach, the outcome. TL;DR first, 1 to 2 scrolls max. The 12-pager is what you bring to the interview.",
    steps: [
      "Open each project with one line: what it was + what it achieved.",
      "State YOUR role explicitly, especially on team projects.",
      "End with an honest outcome: what shipped, feedback you received, or what you learned. Use a number only when you have evidence for it.",
      "Label spec/mock work clearly. It builds trust instead of burning it.",
    ],
    template:
      "TL;DR: [One sentence: what you did + the result]\n\nTHE PROBLEM: [1-2 sentences, why this mattered]\nMY ROLE: [exactly what YOU did, who you worked with]\nTHE APPROACH: [2-3 sentences or 3 bullets, key decisions]\nTHE OUTCOME: [number(s) or a concrete shipped result]",
  },
  visual_craft: {
    meaning:
      "The site itself is evidence of your eye. Type discipline, consistent spacing, and sharp images get judged before a single project opens.",
    steps: [
      "Two typefaces max, used consistently.",
      "Normalize section spacing to one scale sitewide.",
      "Re-export soft images at 2x; compress heavy ones to WebP.",
    ],
  },
  performance: {
    meaning:
      "Slow sites lose recruiters before your work even loads. If nothing useful shows up in about 2.5 seconds, people bounce.",
    steps: [
      "Compress your biggest image or video first. It's almost always the top of the homepage.",
      "Use your builder's image 'optimize' or 'compress' setting. Same look, way smaller files.",
      "If your builder has 'lazy load' for images, turn it on. It loads work as people scroll instead of all at once.",
    ],
  },
  mobile: {
    meaning:
      "Roughly 6 in 10 visits happen on a phone (StatCounter, 2026). Most portfolios look fine on a laptop and fall apart on a phone screen, and the phone version is the one recruiters usually see first.",
    steps: [
      "Open your site on your own phone right now. Is your best work on the first screen? That's your real first impression.",
      "If you have autoplay video, swap it for a still image on mobile. It's the #1 phone slowdown.",
      "Make sure buttons and links aren't crammed together. Thumbs need room.",
    ],
  },
  accessibility: {
    meaning:
      "This is about making sure everyone (and Google) can experience your work. Bonus: the same fixes help your portfolio show up in search results.",
    steps: [
      "Add a short description to every work image. Your builder has a field for this on each image (usually called alt text). 'Times Square billboard for Equinox at night' beats leaving it blank.",
      "Squint test: any text that's light gray on white or hard to read? Darken it.",
      "Use your builder's real page sections (header, main content, footer) instead of stacking loose boxes. Builders handle the technical part for you.",
    ],
  },
  seo_discoverability: {
    meaning:
      "When a recruiter googles you after the interview, or your link gets shared in Slack or iMessage, this decides what they see.",
    steps: [
      "In your builder's settings, set the site title to 'Your Name, the role you want' instead of just your domain.",
      "Add a preview image in your builder's social or sharing settings so shared links show a real image instead of a bare URL.",
      "Write the one-line site description like a pitch. That's the text under your name on Google.",
    ],
  },
  conversion: {
    meaning:
      "An impressed recruiter needs a frictionless next step. Every extra click between 'impressed' and 'inbox' loses people.",
    steps: [
      "Email + LinkedIn + resume, reachable from every page.",
      "One line on availability ('open to full-time marketing roles, NYC').",
      "Name the resume file properly: FirstName-LastName-Resume.pdf.",
    ],
  },
};
