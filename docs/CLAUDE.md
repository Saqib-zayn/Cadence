# Cadence

A public speaking trainer web app. React + Vite, Vercel serverless functions,
Groq Whisper for STT, Groq Llama 3.3 70B for analysis.

## Always read these files before doing anything
- docs/speaksharp-plan.md — full product and technical spec, scoring rubric,
  data storage schema, rate limiting, edge cases, build order
- docs/cadence-design.md — complete design system: every colour token, 
  typography scale, spacing values, border radii, shadows, component patterns

## Visual reference
- stitch-designs/ — screen designs exported from Google Stitch
  Match these closely when building any UI component.
  Do not make visual decisions not shown in these designs or cadence-design.md.

## Hard rules — never break these
- All colours must come from docs/cadence-design.md — no exceptions
- No bottom navigation bar anywhere in the app
- No styled top header bar — only an invisible 52px bar with a floating 
  hamburger icon top-left on mobile
- Never modify useAudioRecorder.js without explicit instruction
- Word must refresh on every new round — keyed to roundKey integer
- No bright or saturated colours — stay within the muted palette in cadence-design.md
- No device frames or phone mockup containers — full viewport width at every size

## Stack
- React + Vite, react-router-dom
- Recharts for charts, html2canvas for share card
- @upstash/redis for rate limiting
- Groq API (Whisper + Llama 3.3 70B)
- Vercel serverless functions in /api/
