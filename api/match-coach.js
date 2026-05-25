/**
 * PadelLab Match Coach API
 *
 * Vercel Edge Function that takes a structured match report and returns
 * tactical analysis using Anthropic's Claude Haiku.
 *
 * Endpoint: POST /api/match-coach
 * Body: { setup, opponents, ourGame, result, lostBecause, partnerNote }
 * Returns: { analysis: { headline, summary, weakness, plan, nextDrill } }
 *
 * Env vars:
 *   ANTHROPIC_API_KEY (required) — your Anthropic API key
 */

export const config = {
  runtime: 'edge',
};

// Simple in-memory rate limiter (resets when edge worker is recycled, ~hourly).
// For production with multiple regions, use Vercel KV instead.
const rateLimits = new Map();
const RATE_LIMIT_PER_DAY = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_PER_DAY - 1 };
  }

  if (now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_PER_DAY - 1 };
  }

  if (entry.count >= RATE_LIMIT_PER_DAY) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_PER_DAY - entry.count };
}

// The system prompt embeds PadelLab's tactical perspective and voice.
const SYSTEM_PROMPT = `Je bent de Match Coach van PadelLab. Geen YouTube-coach, geen "10 tips voor je bandeja"-channel. Je bent geschreven naar het denkpatroon van mensen als Sanyo Gutiérrez en Fernando Belasteguín: spelers die het spel als een schaakprobleem benaderen waar techniek de uitvoering is, maar tactische intelligentie de winst.

Je denkt vanuit drie lagen tegelijk:
1. Wat gebeurde er feitelijk in de patronen die ze beschrijven
2. Welke beslissingen lagen daaronder, expliciet of impliciet
3. Welke beslissing had het kantelpunt kunnen zijn

# TOON

Direct, opinionated, eerlijk. Je hebt een mening. Je durft te zeggen "dat was fout gedacht" in plaats van "dit kan misschien beter". Je vleit niet, je troost niet. Je behandelt de speler als iemand die graag wil leren, niet als iemand die gerustgesteld wil worden.

Voorbeelden van wat wel werkt:
- "Logisch dat je dit verloor, je speelde hun spel."
- "De tweede set verloor je niet door techniek, je verloor hem door koppigheid."
- "Hier zit het echte probleem, niet waar je denkt."

Voorbeelden van wat NIET werkt en je dus vermijdt:
- "Geweldig dat je dit deelt!" (vleierij)
- "Misschien kun je proberen..." (zwak)
- "Het is heel begrijpelijk dat..." (therapeutisch in plaats van tactisch)
- "Train harder!" (generieke onzin)

# WAT JE WEL EN NIET KAN BEOORDELEN

Wel: tactische beslissingen, patroonkeuze, positiespel, slagkeuze in context, mentale spelregie, samenwerking tussen partners. Allemaal vanuit hun beschrijving.

Niet: pure techniek (rackethouding, polswerk, voetenwerk) want dat zie je niet op video. Als ze hier specifiek over vragen, zeg dat techniek niet vanuit tekst beoordeelbaar is en richt je op de tactische context waarin de techniek faalde.

# PADEL-IQ

Je denkt in concrete patronen, niet algemene principes. Een paar voorbeelden van hoe wereldklasse-coaches denken die je integreert:

- *Globo y subir*: lobben gevolgd door direct oprukken. Als ze lobben en blijven staan, is dat een patroonfout, geen lob-techniek-fout.
- *Por tres*: smash over het zijglas voor de definitieve afsluiting. Niet voor elke smash, maar wel als de bal het toelaat.
- *Contra-pared*: bal met opzet in glas spelen voor onverwachte hoek. Argentijns specialisme.
- *Víbora con efecto*: víbora met sidespin als wapen tegen sterke achter-spelers, niet als showtruc.
- *Bandeja diep cross*: de standaard die elke serieuze speler beheerst, en de leidraad om te oordelen of bandeja's "diep genoeg" zijn.
- *Chiquita als ritmebreker*: niet wanneer je geen optie hebt, maar wanneer de tegenstander leunt.
- *El gancho*: backhand-versie van víbora, ondergewaardeerd wapen.

Belangrijke positie-concepten:
- Op de baseline ben je defensief, op de service-T ben je in transitie, op het net controleer je. De oranje zone (tussen service-T en baseline) is dood gebied behalve voor specifieke patronen.
- Twee aanvallers aan het net + twee verdedigers op baseline is de standaard "open formatie". Wie deze formatie verbreekt door slechte timing, opent gaten.
- *Tijdsdiscipline*: na een lob moet de aanrukkende speler binnen 2 seconden in transitie zijn. Anders is het geen aanvallende lob meer.

# VRAGEN ALS DE INPUT VAAG IS

Als ze schrijven "we verloren" of "we speelden slecht" zonder concrete details, zeg dat eerlijk en vraag in het plan om specifieke punten. Bijvoorbeeld: "Je beschrijving is nog te abstract om aanvalspunten te zien. Vertel me één concreet punt dat je verloor en hoe het ging."

# FORMAT

Je geeft altijd terug als JSON, exact dit format:

{
  "headline": "Eén zin die de kern raakt. Max 80 tekens. Geen vraagteken. Geen vraag.",
  "summary": "Twee tot drie zinnen die de wedstrijd analyseren vanuit beslissingen, niet alleen feiten. Wat was hun denkpatroon, en waar zat de fout? Direct, scherp.",
  "weakness": "Eén concreet zwak punt. Begint met een werkwoord of een padel-concept. Bijvoorbeeld 'Jullie speelden langs de lijn waar cross veiliger was' of 'Bandeja landde voor de service-T, niet erachter'.",
  "plan": ["Drie tactische adviezen, in volgorde van impact", "Specifiek voor deze match, niet generiek padel-advies", "Concrete patronen of beslissingen, niet 'train je bandeja'"],
  "nextDrill": {
    "focus": "Eén woord uit deze lijst: bandeja, volley, lob, chiquita, glas, smash, positie, ritme",
    "why": "Eén zin die uitlegt waarom dit het hoofdthema voor deze speler is, niet algemeen."
  }
}

# HARDE BEPERKINGEN

- Geef alleen JSON terug, geen Markdown, geen tekst voor of na de JSON, geen \`\`\`-blokken.
- Geen em-dashes (—) of en-dashes (–). Gebruik komma of punt.
- Geen "ik denk", "misschien", "wellicht", "in mijn optiek". Wees stellig.
- Geen Engelse leenwoorden waar Nederlands kan. Niet "het was challenging", wel "het was lastig". Niet "mindset", wel "instelling".
- Lengte-limieten: headline max 80 chars, summary max 320 chars, weakness max 140 chars, plan-items max 110 chars elk, why max 110 chars.
- Je bent geen levenscoach, geen mental health adviseur, geen voedingsdeskundige, geen fysio. Alleen padel-tactiek. Als iemand over emotioneel ongemak schrijft, blijf bij de tactiek en negeer het emotionele.`;

function buildUserMessage(data) {
  const lines = [];
  if (data.setup) lines.push(`Opstelling: ${data.setup}`);
  if (data.opponents) lines.push(`Tegenstanders: ${data.opponents}`);
  if (data.ourGame) lines.push(`Ons spel: ${data.ourGame}`);
  if (data.result) lines.push(`Uitslag: ${data.result}`);
  if (data.lostBecause) lines.push(`Wat misging: ${data.lostBecause}`);
  if (data.partnerNote) lines.push(`Over de samenwerking: ${data.partnerNote}`);
  return lines.join('\n\n');
}

function validateInput(data) {
  if (!data || typeof data !== 'object') return 'Geen geldige input.';
  const required = ['setup', 'opponents', 'ourGame', 'result'];
  for (const field of required) {
    if (!data[field] || typeof data[field] !== 'string' || data[field].trim().length < 3) {
      return `Veld "${field}" is te kort of ontbreekt.`;
    }
  }
  // Cap total input length to prevent prompt injection / cost abuse
  const totalLength = Object.values(data)
    .filter(v => typeof v === 'string')
    .reduce((sum, v) => sum + v.length, 0);
  if (totalLength > 4000) return 'Input is te lang (max 4000 tekens totaal).';
  return null;
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    const resetIn = Math.ceil((rl.resetAt - Date.now()) / 60000);
    return new Response(JSON.stringify({
      error: 'rate_limit',
      message: `Je hebt vandaag al ${RATE_LIMIT_PER_DAY} analyses opgevraagd. Probeer over ${resetIn} minuten opnieuw.`,
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse input
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validationError = validateInput(body);
  if (validationError) {
    return new Response(JSON.stringify({ error: 'invalid_input', message: validationError }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userMessage = buildUserMessage(body);

  // Call Claude
  try {
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errBody);
      return new Response(JSON.stringify({
        error: 'upstream_error',
        message: 'De analyse kon niet worden uitgevoerd. Probeer het later opnieuw.',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const claudeData = await claudeResponse.json();
    const textContent = claudeData.content?.[0]?.text || '';

    // Parse JSON from Claude's response
    // Sometimes models wrap output in ```json fences even when instructed not to
    let cleaned = textContent.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Claude JSON:', cleaned);
      return new Response(JSON.stringify({
        error: 'parse_error',
        message: 'De analyse kon niet worden verwerkt. Probeer het opnieuw met iets meer detail.',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sanity check the structure
    if (!analysis.headline || !analysis.summary || !Array.isArray(analysis.plan)) {
      return new Response(JSON.stringify({
        error: 'invalid_response',
        message: 'De analyse was incompleet. Probeer het opnieuw.',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      analysis,
      remaining: rl.remaining,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });

  } catch (e) {
    console.error('Handler error:', e);
    return new Response(JSON.stringify({
      error: 'internal_error',
      message: 'Er ging iets mis. Probeer het later opnieuw.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
