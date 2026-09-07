/*
 * Sunlit Glass. Legal pages (Terms of Service + Privacy Policy)
 * One component, two routes. Plain-English disclosures that match how the
 * product actually works. Keep service, data-use and retention disclosures
 * explicit; presentation-only updates do not expand those permissions.
 * NOTE: drafted in-house. get a lawyer's review before public launch.
 */
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const LAST_UPDATED = "September 6, 2026";

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="container pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <p className="pg-brand-eyebrow text-muted-foreground">Legal</p>
          <h1 className="pg-page-title mt-3">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <div className="glass mt-8 space-y-6 rounded-3xl px-6 py-8 text-base leading-relaxed text-foreground sm:px-8">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ heading, children, id }: { heading: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={id ? "scroll-mt-40" : undefined}>
      <h2 className="font-display text-xl font-bold">{heading}</h2>
      <div className="mt-2 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of service">
      <Section heading="What Portfolio Graded does">
        <p>
          Portfolio Graded analyzes portfolio websites you submit and returns a letter grade with
          specific feedback. When you submit a URL, you're asking us to visit and evaluate that
          site. Only submit sites you own or have the right to have evaluated.
        </p>
      </Section>
      <Section heading="What the preview can inspect">
        <p>
          This preview reads the public homepage HTML. Desktop and mobile screenshot capture works
          in the local build; cloud capture is still being connected during this private preview.
          The numerical grade uses HTML signals. When browser capture succeeds, the report separately records opening-view layout, small-control and simple-text contrast observations. These limited samples do not verify project pages, aesthetic quality, complete accessibility, interactions or actual loading speed. We never bypass
          logins, paywalls, or access controls.
        </p>
      </Section>
      <Section heading="Private builder prototype">
        <p>The builder is deferred from the grader launch and retained as a private local prototype. It saves your working draft on this device. Clearing browser storage can remove it; you can save a copy from Settings. Publish in this local test saves a separate snapshot on this Mac and creates a local preview address. It does not publish on the internet or reserve a public subdomain. Public hosting and paid publishing are not enabled. Only include content and images you have permission to use. Review AI suggestions for accuracy before applying or sharing them.</p>
      </Section>
      <Section heading="We keep what you submit">
        <p>
          We retain the submitted link and the resulting analysis indefinitely as part of our
          grading records. Nic may use these records to review and improve the grading guidelines; saving a report does not automatically train a model or change the rubric.
        </p>
      </Section>
      <Section heading="Your submissions improve our grading system">
        <p>
          Nic may review submitted portfolios and analyses to improve the grading guidelines and the instructions used for AI explanations. Changes to those guidelines are reviewed and versioned. There is no automatic model-training or self-updating scoring pipeline in this preview. If you do not want your site used this
          way, don't submit it, or contact us for removal.
        </p>
      </Section>
      <Section heading="Standout portfolio examples">
        <p>Submitted portfolios may be reviewed privately to improve grading. We ask for separate permission before publicly featuring your link or screenshots in the product or marketing. Submitting for a grade does not give that permission or consent to model training. This preview has no automatic model-training pipeline. You keep ownership of your work. Email Nic@jobhuntrecipe.com to request removal from a showcase you previously approved.</p>
      </Section>
      <Section heading="Free reviews and planned Pro">
        <p>All nine initial category grades stay visible. Their explanations and the fix checklist are free; on newly assessed reports, D-detail feedback requires a verified free Google account. The selected guest report can be saved to that account using its original browser, without another grade. Historical reports retain their saved access policy. Initial earned grades top out at A+. The separate S row identifies personal standout strengths supported by available evidence, relative to that portfolio. This designation does not change the earned scores or certify unassessed visuals, phone behavior or hiring prospects. Pro standout details and deeper reviews are in development. Payments are off during this private preview.</p>
        <p>Planned Pro prices are USD $9.99 per month or $49.99 paid upfront for a year. The annual plan is approximately $4.17 per month and saves 58% compared with twelve monthly payments totaling $119.88. Once billing launches, subscriptions renew at the chosen plan price until canceled. Cancel before renewal to avoid the next charge. A paid subscription does not buy a higher numerical grade or guarantee an interview or job. Final checkout, cancellation and refund details will be available before payments open.</p>
      </Section>
      <Section heading="Grades are opinions">
        <p>
          A grade is an editorial, automated assessment: an opinion, not a guarantee of hiring
          outcomes. We aim for feedback a hiring lead would give, but no tool replaces human
          judgment.
        </p>
      </Section>
      <Section heading="Fair use">
        <p>
          Don't abuse the service: no automated mass submissions, no submitting sites you have no
          rights to, no attempts to attack, overload, or reverse-engineer the grader. We rate-limit
          and may block abusive use.
        </p>
      </Section>
      <Section heading="Contact">
        <p>Questions about these terms: Nic@jobhuntrecipe.com.</p>
      </Section>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy policy">
      <Section heading="What we collect">
        <p>
          When you submit a portfolio URL we collect: the URL itself, the publicly available content
          of that homepage (text, image attributes, structure, links, request timings, and page screenshots
          used for the desktop/mobile preview; browser layout observations when capture succeeds; and fingerprints of the downloaded desktop/mobile homepage code, captures and observations for bounded change checks and assessment reuse), your selected target role, your optional answer to "where did you build it," every
          suggestion we've given you and which ones you've checked off, and basic request data
          (IP address, used for rate limiting). An essential random browser cookie links your
          reports and checklist to this browser for up to 180 days. Signing in uses Firebase
          and your Google account identity. We also record timestamped product-usage events using a fixed set of fields, such as selected role or plan and whether a suggestion was checked off. Those basic product-event records exclude account and report IDs, URLs, questions, free-text builder answers and IP addresses. Separate private operational metering is described below. Your raw requested role is retained in the private submission record separately from the rubric actually applied. We also keep sanitized, grouped counts of unsupported roles to understand demand; this free text is not copied into public product-event analytics.
        </p>
      </Section>
      <Section heading="Private usage and cost records">
        <p>When production metering is activated, we record random assessment and attempt identifiers, a pseudonymous account reference when signed in, dates, completion or failure status, model and method versions, returned token counts and measured browser work duration. This helps count completed new assessments once, distinguish account use from anonymous use, monitor costs and recover interrupted work. Saved-report opens and sign-in do not create another completed assessment. Failures can still incur usage. Dollar amounts are labeled estimates when calculated from configured rates; unavailable usage is not treated as a known zero cost.</p>
        <p>These records are private. A configured server service stores them in Google Firestore and can send aggregate usage and cost milestones to Nic through a verified private Slack conversation. Messages contain no portfolio URLs, screenshots, email addresses, account identifiers, prompts or feedback. The local preview does not activate these production notifications. Basic site events and operational metering use separate records.</p>
        <p>Operational event and deduplication records are retained for continuity and accurate counting. Deletion requests cover identifiable account references and detailed event records we can associate with you; nonidentifying accounting totals may remain. Automatic deletion is not available in this preview.</p>
      </Section>
      <Section heading="Portfolio builder drafts">
        <p>Your builder draft, contact fields and selected images are saved in this browser. Images are resized on your device. Google sign-in does not sync these drafts across devices. Use Save a copy of my work in Settings to keep a copy, or Start a new portfolio to remove the current working draft. Starting fresh does not remove separately published previews.</p>
        <p>If you use the design assistant or writing help, your instruction, name, role, introduction, template choices and project text are sent through our server to Anthropic. The dedicated image, contact and link fields are left out. Personal information you type into the included text fields is still sent. We record quota usage to limit requests; the application does not add this draft to the submitted-portfolio ledger or save the AI suggestion on the server. Review and apply suggestions yourself. Building a draft does not submit it for grading or give us permission to feature it. When you publish a local preview, the full portfolio including its contact details and images is saved as a separate snapshot on this Mac. A verified account or an essential browser cookie controls editing. The preview can be viewed by anyone using its address on this Mac. Taking it offline hides the preview; prior snapshots remain in local storage for recovery. A displayed portfoliograded.com address is a proposal until public publishing is enabled.</p>
      </Section>
      <Section heading="Optional marketing emails">
        <p>Marketing emails are optional. If you choose them, we save your verified account email, your choice, its wording and version, and the latest opt-in or withdrawal dates. This preference is separate from saving reports and from permission to feature a portfolio. Change it in Account → Email preferences. Withdrawing removes the mailing address from this preference record; the choice and dates remain until the record is removed. Email delivery is not connected in this preview.</p>
      </Section>
      <Section heading="Saved reports and change checks">
        <p>Reports are private to the signed-in account or the essential browser cookie that created them. Browser-created reports are not imported automatically. When you choose free sign-in to read a selected report’s feedback, we transfer that report and its associated checklist to your verified Google account if this browser still holds the original essential cookie. Other guest reports stay separate. The transfer records its date and original anonymous owner reference to verify retries; it does not enroll you in marketing. Opening a saved report does not run a new grade or replace its saved screenshots. A deliberate change check fetches the public homepage again without AI and compares its downloaded code. It does not establish that separate stylesheets, images, interactions or the whole website are unchanged.</p>
        <p>A requested new review also compares complete bounded homepage source, captured opening views and browser observations, along with the requested role and method version. When those match an accepted assessment, we can reuse its original grade, date and images without another AI explanation call. This does not establish that project pages or untested interactions are unchanged. A failed or incomplete check preserves the prior accepted result. Best-earned milestones are dated separately from the current report and only compared within the same method.</p>
        <p>New reports reference the images captured during that review. Images use a limited rolling archive and may expire while their report and measurements remain. Older reports may not have archived images or a comparison fingerprint. We do not replace an expired historical screenshot with a new one and present it as the old capture.</p>
      </Section>
      <Section heading="How long we keep it">
        <p>
          Submitted links and their analyses are kept indefinitely. Nic may review this history when improving the guidelines. Saved records do not automatically train a model.
        </p>
      </Section>
      <Section heading="How we use it" id="how-we-use-it">
        <p>
          We save your URL, selected role, optional builder answer, available screenshots, feedback
          and checklist progress so you can return to your report. We use your submission to grade
          your portfolio and prevent abuse. Nic may privately review these records to improve the
          grading guidelines and AI explanation instructions. This preview has no automatic
          model-training pipeline. Submitting for a grade does not give consent to model training.
        </p>
        <p>We ask for separate permission before publicly featuring your portfolio link or screenshots in the product or marketing. A grading submission does not give that permission. You retain ownership of your work, and we do not publish your private fix checklist or account details as part of an example. Email Nic@jobhuntrecipe.com to request removal from a showcase you previously approved. We do not sell your data.</p>
      </Section>
      <Section heading="Who touches the data">
        <p>
          The hosted private preview runs on Railway infrastructure. The local build runs on
          Nic's computer. Anthropic
          receives extracted homepage text and scan signals when AI analysis is enabled.
          Google Firebase handles sign-in verification and, when enabled, private operational usage storage. A configured Slack service receives aggregate operational milestones only. Stripe will handle payments when
          billing launches; payments are disabled in this preview. Saved reports, submitted
          URLs and recent screenshots are retained in our private application storage.
          Ask Nic sends your question, any report text you include and recent chat messages to Anthropic to generate a reply. It does not automatically receive server-only report details.
          Fonts and decorative assets may load from external providers as part of displaying the site.
        </p>
      </Section>
      <Section heading="Public content only">
        <p>
          We only access publicly available website content, never anything behind a login,
          paywall, or access control.
        </p>
      </Section>
      <Section heading="Deletion requests">
        <p>
          Want your site's link and analysis removed from our records? Email Nic@jobhuntrecipe.com
          from an address that can reasonably demonstrate ownership of the site. We will remove the associated report, saved images and checklist records we can identify. Account-data requests also cover the marketing preference record, report-claim provenance and identifiable operational usage records. This is handled manually; automated account deletion is not available in the preview.
        </p>
      </Section>
      <Section heading="Contact">
        <p>Privacy questions: Nic@jobhuntrecipe.com.</p>
      </Section>
    </LegalShell>
  );
}
