# @utanihur/web

Frontend do bazar de personagens (estilo [Exevo Pan](https://www.exevopan.com)) construído com Vite + React + TypeScript + Tailwind CSS.

## Rodando

```bash
# na raiz do monorepo
npm install
npm run api   # API em http://localhost:3001
npm run web   # frontend em http://localhost:3000 (proxy /api → :3001)
```

## Funcionalidades

- Grade responsiva de cards de leilão (outfit, level, vocação, mundo, charms, achievements, top skills, itens em destaque, countdown e lance)
- Drawer de filtros: nickname, vocação, sexo, mundo, level mín/máx e magic level
- Ordenação (fim do leilão, level, lance, magic level) e paginação
- Tema claro/escuro com persistência
- Favoritos salvos em `localStorage`

## Áreas de propaganda

O componente `src/components/AdSpace.tsx` renderiza três espaços reservados:

| Slot | Posição | Formato |
| --- | --- | --- |
| `bazaar-top` | abaixo do header | leaderboard 728×90 |
| `bazaar-feed-N` | dentro da grade, a cada 8 cards | card in-feed |
| `bazaar-bottom` | antes do rodapé | leaderboard 728×90 |

As instruções para plugar o Google AdSense estão comentadas no próprio arquivo.

## Imagens de outfits/itens

A imagem do personagem é resolvida em cadeia, na ordem:

1. `public/sprites/looktypes/{lookType}_{addons}.gif` — sprites baixadas por lookType. Gere-as com `npm run sprites` na raiz (lê os lookTypes presentes nos dados coletados e baixa as imagens oficiais do char bazaar; idempotente).
2. `public/sprites/outfits/{male|female}/{Nome}_{addons}.gif` — sprites nomeadas, correlacionadas pelo mapa curado em `src/data/outfitMap.ts` (outfits clássicos).
3. URL remota (configurável via `VITE_OUTFIT_URL` no `.env`).
4. Badge da vocação (fallback final).

Sprites de monstros/bosses/mounts/charms em `public/sprites/` ficam disponíveis para páginas futuras (o card já usa `charms/Charm.png`).
