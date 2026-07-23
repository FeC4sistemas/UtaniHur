/*
  Áreas reservadas para propaganda (Google AdSense, GPT, mídia própria etc).

  Para ativar o AdSense:
  1. Adicione o script do AdSense no <head> de index.html:
     <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
  2. Substitua o conteúdo do placeholder abaixo pelo <ins class="adsbygoogle" ... data-ad-slot="..."> correspondente
     e chame (adsbygoogle = window.adsbygoogle || []).push({}) num useEffect.

  Cada variante corresponde a um formato IAB comum:
  - leaderboard: banner horizontal no topo (max 728×90, responsivo)
  - inFeed: card do tamanho de um leilão, inserido no meio da grade
  - footer: banner horizontal antes do rodapé
*/

type Variant = 'leaderboard' | 'inFeed' | 'footer'

const VARIANT_CLASSES: Record<Variant, string> = {
  leaderboard: 'h-[90px] w-full max-w-[728px] mx-auto',
  inFeed: 'h-full min-h-[280px] w-full',
  footer: 'h-[90px] w-full max-w-[728px] mx-auto',
}

export function AdSpace({ variant, slot }: { variant: Variant; slot: string }) {
  return (
    <div
      data-ad-slot={slot}
      data-ad-variant={variant}
      role="complementary"
      aria-label="Publicidade"
      className={`${VARIANT_CLASSES[variant]} relative grid place-items-center overflow-hidden rounded-lg border border-dashed border-separator bg-surface/60`}
    >
      <span className="absolute left-2 top-1.5 text-[10px] font-medium uppercase tracking-wider text-onSurface/35">
        Publicidade
      </span>
      <div className="flex flex-col items-center gap-1 text-onSurface/25">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 15l5-5 4 4 3-3 6 6" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
        <span className="text-xs font-medium">Seu anúncio aqui</span>
      </div>
    </div>
  )
}
