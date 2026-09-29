import { useEffect, useRef, useState } from 'react'

interface MenuItem {
  title: string
  desc: string
  href: string
}

interface Menu {
  id: string
  label: string
  items: MenuItem[]
}

const MENUS: Menu[] = [
  {
    id: 'product',
    label: 'Product',
    items: [
      {
        title: 'Statement reading',
        desc: 'PDF, scanned, Excel or CSV supplier statements — AI reads the paperwork, checked against the printed closing balance',
        href: '#ai',
      },
      {
        title: 'Matching engine',
        desc: 'Invoices, payments and credits matched line by line by a deterministic six-pass engine — in your browser',
        href: '#how',
      },
      {
        title: 'Exceptions & bridge',
        desc: 'Differences named in AP language and bridged — the unexplained residual is always shown',
        href: '#features',
      },
      {
        title: 'Supplier email',
        desc: 'A drafted, ready-to-review query email built from the findings — nothing sent automatically',
        href: '#features',
      },
      {
        title: 'Monthly workflow',
        desc: 'Batch runs across suppliers, browser-local run history, and recurring exceptions flagged month over month',
        href: '#monthly',
      },
      {
        title: 'Invoices on hold',
        desc: 'Upload your ERP\u2019s on-hold report — a supplier-wise queue with reason-aware request drafts, proof verification, and chase aging',
        href: '#holds',
      },
    ],
  },
  {
    id: 'why',
    label: 'Why TieOut',
    items: [
      {
        title: 'Our AI',
        desc: 'AI reads documents and words explanations — a deterministic engine does every number',
        href: '#ai',
      },
      {
        title: 'Privacy',
        desc: 'Your AP ledger never leaves your browser; nothing is stored on a server',
        href: '#privacy',
      },
      {
        title: 'No ERP integration',
        desc: 'Works with the exports you already have — no connectors, no IT project, no credentials',
        href: '#privacy',
      },
      {
        title: 'Pricing',
        desc: 'Solo $49/month with 25 AI statement reads; Team & Firm by agreement — 14-day free trial, no card required',
        href: '#pricing',
      },
    ],
  },
]

interface LandingNavProps {
  onOpenApp: () => void
  onSampleRun: () => void
}

export function LandingNav({ onOpenApp, onSampleRun }: LandingNavProps) {
  const [open, setOpen] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const closeAll = () => {
    setOpen(null)
    setMobileOpen(false)
  }

  return (
    <nav ref={navRef} className="relative mx-auto max-w-6xl px-6">
      <div className="flex items-center justify-between py-5">
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pine text-lg font-extrabold text-white">
            TA
          </span>
          <span>
            <span className="block text-xl font-extrabold tracking-tight text-ink">
              TieOut <span className="text-pine">AP</span>
            </span>
            <span className="block text-xs font-medium text-ink-faint">
              Every difference explained
            </span>
          </span>
        </span>

        {/* Desktop menu */}
        <div className="hidden items-center gap-1 md:flex">
          {MENUS.map((menu) => (
            <button
              key={menu.id}
              type="button"
              aria-expanded={open === menu.id}
              onClick={() => setOpen((o) => (o === menu.id ? null : menu.id))}
              className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-bold transition-colors ${
                open === menu.id
                  ? 'btn-primary'
                  : 'text-ink hover:bg-moss hover:text-pine'
              }`}
            >
              {menu.label}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-4 w-4 transition-transform ${open === menu.id ? 'rotate-180' : ''}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ))}
          <a
            href="#contact"
            onClick={closeAll}
            className="rounded-full px-3.5 py-2 text-sm font-bold text-ink hover:bg-moss hover:text-pine"
          >
            Contact
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSampleRun}
            className="hidden rounded-full border-2 border-line px-4 py-2 text-sm font-bold text-ink hover:border-pine hover:text-pine sm:block"
          >
            See a sample run
          </button>
          <button
            type="button"
            onClick={onOpenApp}
            className="btn-primary px-4.5 py-2 text-sm font-bold transition-colors"
          >
            Open the app
          </button>
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => {
              setMobileOpen((o) => !o)
              setOpen(null)
            }}
            className="rounded-sm p-2 text-ink hover:bg-ink/5 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              {mobileOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop dropdown panel */}
      {MENUS.map(
        (menu) =>
          open === menu.id && (
            <div
              key={menu.id}
              className="absolute left-0 right-0 top-full z-20 hidden px-6 md:block"
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 rounded-2xl border border-line bg-paper p-8 shadow-xl shadow-ink/10 lg:grid-cols-4">
                {menu.items.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    onClick={closeAll}
                    className="group block"
                  >
                    <p className="text-base font-bold text-ink group-hover:text-pine">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.desc}</p>
                  </a>
                ))}
              </div>
            </div>
          ),
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-20 px-6 md:hidden">
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-xl shadow-ink/10">
            {MENUS.map((menu) => (
              <div key={menu.id} className="mb-4">
                <p className="text-[13px] font-bold text-pine">
                  {menu.label}
                </p>
                <div className="mt-2 space-y-2">
                  {menu.items.map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      onClick={closeAll}
                      className="block text-sm font-semibold text-ink hover:text-pine"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
            <a
              href="#contact"
              onClick={closeAll}
              className="block text-sm font-semibold text-ink hover:text-pine"
            >
              Contact
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
