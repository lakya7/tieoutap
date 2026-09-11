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
        desc: 'Every difference named in AP language and bridged exactly — down to 0.00 unexplained',
        href: '#features',
      },
      {
        title: 'Supplier email',
        desc: 'A drafted, ready-to-review query email built from the findings — nothing sent automatically',
        href: '#features',
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
        desc: '$19/month, everything included — 14-day free trial, no card required',
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
        <span className="font-display text-xl font-bold tracking-tight text-slate-900">
          TieOut <span className="text-blue-700">AP</span>
        </span>

        {/* Desktop menu */}
        <div className="hidden items-center gap-1 md:flex">
          {MENUS.map((menu) => (
            <button
              key={menu.id}
              type="button"
              aria-expanded={open === menu.id}
              onClick={() => setOpen((o) => (o === menu.id ? null : menu.id))}
              className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                open === menu.id
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-blue-700'
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
            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-700"
          >
            Contact
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSampleRun}
            className="hidden rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:block"
          >
            See a sample run
          </button>
          <button
            type="button"
            onClick={onOpenApp}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
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
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
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
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/10 lg:grid-cols-4">
                {menu.items.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    onClick={closeAll}
                    className="group block rounded-lg"
                  >
                    <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.desc}</p>
                  </a>
                ))}
              </div>
            </div>
          ),
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-20 px-6 md:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10">
            {MENUS.map((menu) => (
              <div key={menu.id} className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {menu.label}
                </p>
                <div className="mt-2 space-y-2">
                  {menu.items.map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      onClick={closeAll}
                      className="block text-sm font-semibold text-slate-800 hover:text-blue-700"
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
              className="block text-sm font-semibold text-slate-800 hover:text-blue-700"
            >
              Contact
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
