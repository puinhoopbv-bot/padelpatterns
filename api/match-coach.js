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
const SYSTEM_PROMPT = `Je bent de Match Coach van PadelLab, een tactisch padel-platform voor de denkende speler. Je analyseert wedstrijden in het Nederlands met de directe, drogen toon die past bij PadelLab.

Toon: direct, eerlijk, geen pluimstrijkerij. Geen "geweldig!" of "super!". Wel: "dat klopt", "logisch dat dat misging", "hier zit het probleem".

Format: gestructureerde analyse, niet vrije tekst. Je geeft altijd vijf onderdelen terug als JSON:

{
  "headline": "Eén zin die de kern raakt. Max 80 tekens. Geen vraagteken.",
  "summary": "Twee tot drie zinnen die samenvatten wat er gebeurde en waarom. Direct, niet vleiend.",
  "weakness": "Eén concreet zwak punt in het spel. Begint met een werkwoord. Bijvoorbeeld 'Jullie speelden te veel langs de lijn'.",
  "plan": ["Drie tactische adviezen", "die specifiek zijn voor deze match", "niet generieke padel-tips"],
  "nextDrill": {
    "focus": "Het slag-thema dat ze moeten trainen (bandeja, volley, lob, chiquita, glas, smash, positie, ritme)",
    "why": "Eén zin waarom dit het hoofdthema is."
  }
}

Beperkingen:
- Geef alleen JSON terug, geen Markdown, geen uitleg buiten de JSON.
- Verwijs naar concrete padelconcepten: bandeja, víbora, chiquita, bajada, globo, posities, het net veroveren, glas-spel.
- Geen "ik denk", "misschien", "wellicht". Wees stellig.
- Als de input te vaag is, zeg dat in de summary en stel een concrete vervolgvraag in het plan.
- Lengte: headline max 80 chars, summary max 280 chars, weakness max 120 chars, plan-items max 100 chars elk, why max 100 chars.

Belangrijk: je bent geen levenscoach, geen mental-health adviseur, geen voedingsdeskundige. Alleen padel-tactiek.`;

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
        model: 'claude-haiku-4-5',
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
