import { exportPortfolioHTML, validatePortfolioDraft, type PortfolioDraft } from "./portfolio";

export const templateMetadata = [
  { id: "editorial", name: "Editorial", description: "Warm, thoughtful and full of character.", detail: "Expressive type, generous space and stories worth opening.", color: "#e4d2a9" },
  { id: "gallery", name: "Gallery", description: "A quiet frame for distinctive work.", detail: "An artful collection with a clean, gallery-like rhythm.", color: "#d8dfd0" },
  { id: "studio", name: "Studio", description: "A confident presence. A clear point of view.", detail: "Bold type, rich contrast and a contemporary studio feel.", color: "#d6bd70" },
] as const;

/** Preview-only sample copy. Never seed or overwrite a user's saved draft with
 * this data when they choose a template; createEmptyPortfolioDraft still starts blank.
 */
export function getTemplateDemo(template: PortfolioDraft["template"]): PortfolioDraft {
  return validatePortfolioDraft({
    id: `template-preview-${template}`, revision: 1, updatedAt: "2026-09-06T00:00:00.000Z", template, accent: "gold",
    name: "Alex Morgan", role: "Graphic Design", headline: template === "editorial" ? "Thoughtful design.\nA human point of view." : template === "gallery" ? "A collection of identities, images and considered details." : "Ideas with purpose.\nWork with personality.",
    bio: "I’m a designer drawn to the space between a good idea and a thoughtful detail. My work explores how identity, imagery and everyday experiences can feel a little more human.",
    email: "hello@example.com", location: "Brooklyn, New York", links: [{id:"demo-link",label:"Say hello ↗",url:"https://example.com"}],
    projects: [
      { id:"preview-project-one", title:"Groundwork", summary:"An independent brand concept for a slower, more thoughtful approach to everyday living.", role:"Concept & visual identity", process:"Exploring a simple wordmark, a natural palette and a system that gives small details room to matter.", outcome:"A self-directed concept study, presented here as example content." },
      { id:"preview-project-two", title:"Quiet Hours", summary:"An editorial concept about finding a little space in a busy world.", role:"Art direction & editorial design", process:"Pairing expressive type with a restrained layout, using rhythm and white space to guide the reader.", outcome:"A sample editorial direction shown for this template preview." },
      { id:"preview-project-three", title:"Common Ground", summary:"A playful visual study of shared spaces and the people who bring them to life.", role:"Identity exploration", process:"Working with modular shapes, warm colors and a flexible type system.", outcome:"An illustrative concept project, not a claim about a real client." },
    ],
  });
}

/** Real renderer output with a visible preview label, ready for a chooser iframe. */
export function getTemplatePreviewHTML(template: PortfolioDraft["template"]): string {
  return exportPortfolioHTML(getTemplateDemo(template)).replace('<body class=', '<body data-template-demo="true" class=').replace('<a class="skip"', '<div style="background:#292b26;color:#fff8e5;font:10px/1.4 system-ui,sans-serif;letter-spacing:.08em;text-align:center;padding:7px 12px">TEMPLATE PREVIEW · EXAMPLE CONTENT</div><a class="skip"');
}
