# PadelLab Match Coach, deploy & setup

## Wat dit is

De Match Coach (`/tools/match-coach`) is je eerste AI-tool. Gebruikers beschrijven hun wedstrijd via een gestructureerd formulier. De backend stuurt dat naar Claude Haiku 4.5 via de Anthropic API en krijgt een tactische analyse terug in JSON-formaat: headline, summary, kernpunt, plan, en next-drill.

## Bestanden

- `api/match-coach.js` — Vercel Edge Function, de API endpoint
- `tools/match-coach.html` — De UI

## Deploy stappen

### 1. Anthropic API key krijgen

Ga naar https://console.anthropic.com/, maak een account, ga naar Settings → API Keys, en genereer een key. Bewaar hem veilig.

Top-up je account met minimaal €5 om te beginnen. Dat is ruim voldoende voor maanden testen.

### 2. Vercel environment variable instellen

In je Vercel project dashboard:

1. Ga naar Settings → Environment Variables
2. Voeg toe:
   - Name: `ANTHROPIC_API_KEY`
   - Value: (jouw key, begint met `sk-ant-...`)
   - Environments: Production, Preview, Development (alle drie aanvinken)
3. Save

### 3. Deploy

```bash
git add .
git commit -m "Match Coach: AI-powered tactical match analysis"
git push
```

Vercel detecteert `/api/*` automatisch als Edge Functions. Geen extra config nodig.

### 4. Verifieer na deploy

Ga naar https://padelpatterns.com/tools/match-coach, vul een match-beschrijving in, klik "Analyseer mijn match". Je hoort binnen ~15 seconden een analyse te zien. Zo niet, check Vercel logs voor errors.

## Kosten

Claude Haiku 4.5 pricing (per miljoen tokens):
- Input: $1.00
- Output: $5.00

Per match-analyse gebruik je ongeveer:
- Input: 1.000-1.500 tokens (system prompt + user input)
- Output: 400-600 tokens (JSON response)

Dus per analyse ongeveer $0.0035, zo'n 0.3 cent.

**Bij 100 analyses per dag**: ~€10/maand
**Bij 1.000 analyses per dag**: ~€100/maand
**Bij 10.000 analyses per dag**: ~€1.000/maand (dan tijd om over premium na te denken)

## Rate limiting

Er zit een in-memory rate limit van 10 analyses per IP per 24 uur in `api/match-coach.js`. Dat is genoeg voor eerlijk gebruik en beschermt tegen abuse.

**Belangrijk**: dit werkt per Edge Function instance. Vercel kan meerdere instances tegelijk draaien, dus iemand kan in theorie meer dan 10 doen door snel meerdere requests te sturen. Voor strikte rate limiting, upgrade naar Vercel KV (Redis) of gebruik Upstash.

## Monitoring

Houd in de gaten:
- Vercel Functions tab: errors, latency, invocations
- Anthropic Console: spend per dag
- Plausible/Umami: bounce-rate op /tools/match-coach

Als je conversies wilt meten (mensen die na de analyse doorklikken naar trainings-generator), tag de link `/tools/training?goal=...&utm_source=match-coach` zodat je dat kunt traceren.

## Toekomst

Mogelijke verbeteringen, niet nu:
- Vercel KV voor strikt rate-limiting over instances heen
- Prompt caching (90% korting bij Anthropic) als je een vaste system prompt gebruikt en hoog volume haalt
- Streaming response voor sneller "perceived" antwoord
- Optionele follow-up vragen ("Verdiep deze analyse")
- Video-input voor pro-niveau (Sonnet/Opus met vision)

## Veiligheid

De system prompt staat in `api/match-coach.js`, niet client-side. Mensen kunnen je prompt-engineering niet stelen door je code te inspecteren.

De API key staat alleen in Vercel env vars. Nooit commiten naar Git.

User input wordt gevalideerd (lengte, type) voor het naar Claude gaat. Niet rocket-science, maar voorkomt grove abuse.

## Wat te doen als het niet werkt

1. Check Vercel Logs: zie je requests naar `/api/match-coach`?
2. Check status codes:
   - 400: input is te kort (validatie-fout)
   - 429: rate limit hit
   - 500: server misconfigured (ANTHROPIC_API_KEY niet ingesteld)
   - 502: Claude API gaf error (check Anthropic Status)
3. Open browser DevTools → Network tab, kijk naar de POST request naar `/api/match-coach`
4. Mail Anthropic support als de API zelf down lijkt

## Privacy-overweging

User input wordt direct doorgestuurd naar Anthropic. Dit moet je vermelden in je privacy-statement. Voorbeeld-tekst:

> Onze Match Coach gebruikt de Anthropic Claude API voor het analyseren van je wedstrijd-beschrijving. De tekst die je invoert wordt verstuurd naar Anthropic. Anthropic gebruikt deze inputs niet voor model-training. Anthropic bewaart de inputs maximaal 30 dagen voor abuse-monitoring en verwijdert ze daarna. Lees [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy) voor details.
