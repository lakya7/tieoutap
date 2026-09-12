export type TrustPageId = 'privacy-policy' | 'terms' | 'security'

interface TrustPageProps {
  page: TrustPageId
  onHome: () => void
}

interface Block {
  heading: string
  paras: string[]
  list?: string[]
}

interface PageContent {
  title: string
  intro: string
  blocks: Block[]
}

const LAST_UPDATED = '12 September 2026'

const PAGES: Record<TrustPageId, PageContent> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    intro:
      'TieOut AP is built so that the least possible data ever reaches us. This page describes exactly what we hold, what we never see, and who processes what on our behalf.',
    blocks: [
      {
        heading: 'What never leaves your browser',
        paras: [
          'Your AP ledger export never leaves your browser, in any circumstance. Supplier statements uploaded as Excel, CSV, TSV or semicolon-delimited files never leave your browser either. Parsing, matching, classification, and every calculation run locally on your machine. We have no server that receives, stores, or could store these files.',
          'Shareable run links encode the run data into the link itself (in the URL fragment, which browsers do not send to servers). Anyone you give a link to can see that run, so share links only with people who should see the data.',
        ],
      },
      {
        heading: 'The one exception: PDF and image statements',
        paras: [
          'If you choose to upload a supplier statement as a PDF or image, that one file makes a single round trip: it is sent over an encrypted connection to our serverless endpoint, passed to Anthropic to be read into structured lines, and the extracted lines are returned to your browser. The file is not written to disk or stored by us; it exists only for the duration of the request. Reconciliation then runs locally as usual. This path is opt-in — if you export the statement to Excel or CSV instead, nothing is sent at all.',
        ],
      },
      {
        heading: 'Optional AI features and what they send',
        paras: ['Each AI feature sends the minimum needed, and only when you use it:'],
        list: [
          'AI column mapping: the header row of your file and up to three sample values per column — never the file.',
          'AI findings summary and email wording: the findings produced by the deterministic engine (references, classifications, amounts) — never your files.',
          'PDF/image reading: the statement document, as described above.',
        ],
      },
      {
        heading: 'What we hold about you',
        paras: ['If you create an account, we hold:'],
        list: [
          'Your email address and authentication data, managed by Supabase.',
          'Your subscription and payment status, managed by Stripe. We never see or store card numbers.',
          'Messages you send through the contact form (name, email, message), delivered to our inbox by Web3Forms.',
        ],
      },
      {
        heading: 'What we do not do',
        paras: [],
        list: [
          'No analytics or tracking scripts on the site.',
          'No selling or sharing of personal data.',
          'No marketing emails without your consent — account emails (confirmation, password reset) only.',
          'No connection to your ERP, and no credentials for it.',
        ],
      },
      {
        heading: 'Subprocessors',
        paras: ['We rely on the following providers to run the service:'],
        list: [
          'Vercel — hosting and serverless endpoints.',
          'Supabase — account authentication.',
          'Stripe — billing and subscriptions.',
          'Anthropic — reading PDF/image statements and wording summaries, only when you use those features.',
          'Web3Forms — contact form delivery.',
          'Hostinger — outbound account email (sent from noreply@tieoutap.com).',
        ],
      },
      {
        heading: 'Your rights and contact',
        paras: [
          'You can ask us to delete your account and the data we hold about you at any time. Contact us through the contact form on the home page and we will respond by email.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro:
      'These terms govern your use of TieOut AP at tieoutap.com. By creating an account or using the service you agree to them.',
    blocks: [
      {
        heading: 'The service',
        paras: [
          'TieOut AP reconciles supplier statements against your accounts payable ledger: it matches documents, classifies differences, and produces a bridge between the two balances, together with drafted explanations. Reconciliation runs in your browser; optional AI features are described in the Privacy Policy.',
        ],
      },
      {
        heading: 'Accounts, trial, and billing',
        paras: [
          'Sign-up is free and includes a 14-day free trial with full access — no card required. After the trial, continued use requires a paid subscription ($19 per month, billed by Stripe). You can cancel at any time from the billing portal; access continues to the end of the paid period. Prices may change with notice; changes never apply retroactively to a period you have already paid for.',
        ],
      },
      {
        heading: 'Your responsibilities',
        paras: [
          'You are responsible for the files you upload and for having the right to process them. TieOut AP is a working tool for finance professionals, not an accounting, audit, or legal opinion: review the findings before acting on them. Drafted supplier emails are drafts — nothing is ever sent on your behalf.',
        ],
      },
      {
        heading: 'Acceptable use',
        paras: [],
        list: [
          'No attempts to breach, probe, or overload the service.',
          'No reselling or providing the service to third parties as your own.',
          'No use of the AI features for content unrelated to reconciliation.',
        ],
      },
      {
        heading: 'Availability and liability',
        paras: [
          'The service is provided "as is". We work to keep it available and correct, but we do not guarantee uninterrupted availability, and our total liability for any claim is limited to the amount you paid us in the twelve months before the claim. Nothing in these terms limits liability that cannot lawfully be limited.',
        ],
      },
      {
        heading: 'Changes and contact',
        paras: [
          'We may update these terms; material changes will be announced on the site or by email before they take effect. Questions — use the contact form on the home page.',
        ],
      },
    ],
  },
  security: {
    title: 'Security & Data Handling',
    intro:
      'The clearest security statement we can make: for the default workflow, your files never reach us. Here is precisely what runs where.',
    blocks: [
      {
        heading: 'Local by architecture, not by policy',
        paras: [
          'Ledger parsing, statement parsing (Excel/CSV/TSV), matching, classification, and the balance bridge run entirely in your browser as compiled JavaScript. There is no upload step for these files: the code that would send them does not exist. This is stronger than a policy promise of encryption or deletion — the data is simply never transmitted.',
        ],
      },
      {
        heading: 'What is transmitted, exactly',
        paras: ['Three optional features make network requests, each sending only:'],
        list: [
          'PDF/image statement reading: the document itself, one round trip, processed in memory, never stored.',
          'AI column mapping: the header row and up to three sample values per column.',
          'AI summary and email wording: the deterministic findings (references, classifications, amounts).',
        ],
      },
      {
        heading: 'Transport and access',
        paras: [],
        list: [
          'All traffic is encrypted in transit (TLS).',
          'AI endpoints require a signed-in account; the AI provider key is held server-side and never exposed to the browser.',
          'We hold no ERP credentials and have no integration that could write to your systems.',
          'Card details are handled entirely by Stripe; we never see them.',
        ],
      },
      {
        heading: 'Determinism as a control',
        paras: [
          'The reconciliation engine is deterministic: the same two files always produce the same findings and the same bridge, with integer-cent arithmetic throughout. Uncertain matches are flagged for human confirmation rather than silently applied, and the bridge either ties out exactly or the tool refuses and says why. AI never produces, adjusts, or approves a number.',
        ],
      },
      {
        heading: 'Reporting a concern',
        paras: [
          'If you believe you have found a security issue, contact us through the contact form on the home page and we will respond promptly by email.',
        ],
      },
    ],
  },
}

export function TrustPage({ page, onHome }: TrustPageProps) {
  const content = PAGES[page]
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={onHome}
            className="font-serif text-2xl font-medium tracking-tight text-ink hover:text-pine"
            title="Back to home page"
          >
            TieOut <span className="text-pine">AP</span>
          </button>
          <button
            type="button"
            onClick={onHome}
            className="text-sm font-semibold text-ink-soft hover:text-pine"
          >
            &larr; Home
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
          Last updated: {LAST_UPDATED}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-ink">
          {content.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">{content.intro}</p>

        <div className="mt-12 space-y-10">
          {content.blocks.map((block) => (
            <section key={block.heading} className="border-t border-line pt-6">
              <h2 className="font-serif text-xl font-medium text-ink">{block.heading}</h2>
              {block.paras.map((p) => (
                <p key={p.slice(0, 40)} className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
              {block.list && (
                <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-soft">
                  {block.list.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span aria-hidden="true" className="text-pine">
                        —
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-6 text-xs text-ink-faint">
          <span className="font-serif text-sm text-ink-soft">TieOut AP — tieoutap.com</span>
          <a href="#privacy-policy" className="hover:text-pine">
            Privacy Policy
          </a>
          <a href="#terms" className="hover:text-pine">
            Terms
          </a>
          <a href="#security" className="hover:text-pine">
            Security
          </a>
        </div>
      </footer>
    </div>
  )
}
