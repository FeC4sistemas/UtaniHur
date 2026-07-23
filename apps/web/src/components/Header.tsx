import { MoonIcon, SunIcon } from './Icons'
import { useTheme } from '../hooks/useTheme'

const NAV = [
  { label: 'Bazar Atual', active: true },
  { label: 'Histórico', active: false },
  { label: 'Estatísticas', active: false },
]

export function Header() {
  const { dark, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-40 bg-primary shadow-md dark:bg-surface dark:shadow-[0_1px_0_0_rgb(var(--separator))]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <a href="/" className="flex items-center gap-2.5" aria-label="UtaniHur — início">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white/15 text-lg font-extrabold text-white dark:bg-primary/20 dark:text-primary">
            U
          </span>
          <span className="text-lg font-bold tracking-tight text-white dark:text-onSurface">
            Utani<span className="text-primaryVariant dark:text-primary">Hur</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Principal">
          {NAV.map(item =>
            item.active ? (
              <a
                key={item.label}
                href="/"
                aria-current="page"
                className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold text-white dark:bg-primary/15 dark:text-primary"
              >
                {item.label}
              </a>
            ) : (
              <span
                key={item.label}
                title="Em breve"
                className="cursor-default rounded-md px-3 py-1.5 text-sm font-medium text-white/60 dark:text-onSurface/40"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="pressable grid h-9 w-9 place-items-center rounded-md text-white/90 transition-colors duration-150 hover:bg-white/10 dark:text-onSurface/80 dark:hover:bg-white/5"
          >
            {dark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}
