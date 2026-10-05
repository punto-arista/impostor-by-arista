# impostor-by-arista

Juego de impostor desarrollado por arista. Web app instalable (PWA) para jugar en grupo con un solo dispositivo.

- Arquitectura y decisiones: [ARQUITECTURA.md](ARQUITECTURA.md)
- Plan de trabajo paso a paso: [PLAN.md](PLAN.md)
- Mockup original: [Mockup/](Mockup/)

## Desarrollo

Requiere Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # lógica del juego (Vitest)
npm run build      # build de producción + service worker
npm run icons      # regenera los íconos de la PWA (public/icons)
npm run import:dry # valida content/*.json sin tocar Supabase
npm run import     # valida y sincroniza content/ con Supabase (requiere .env.local)
npm run seed       # regenera el catálogo del modo local desde content/
```

### Modo local y modo Supabase

- **Sin `.env.local`** la app corre en *modo local*: sin login ni historial, con el catálogo semilla (`src/data/seed.json`, generado desde `content/` con `npm run seed`). Sirve para desarrollar la interfaz.
- **Con `.env.local`** (copia `.env.example`) usa Supabase: login con usuario + PIN, catálogo desde la base de datos y registro de rondas.

## Estructura

```
src/game/      lógica pura (sorteo, reducer, límites) con pruebas; no conoce React ni Supabase
src/data/      Supabase, catálogo (caché en IndexedDB), historial offline, ajustes
src/auth/      sesión y login
src/pwa/       instalación, pantalla completa, wake lock, aviso de actualización
src/screens/   pantallas: Install, Login, Setup, Handoff, Reveal, Discuss, Final
src/styles/    tokens del design system de arista + estilos de la app
```
