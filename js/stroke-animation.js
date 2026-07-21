/* =====================================================================
   PADELLAB — Slag-animatie
   Een zijaanzicht van de slag-uitvoering: stokfiguur, racketbaan en balbaan.

   Waarom 2D-SVG en niet de 3D-engine van Patterns 3D: die tool toont waar
   spelers STAAN, niet hoe ze slaan — de speler-tokens daar hebben geen armen,
   handen of racket. Techniek is bovendien juist een zij-aanzicht-verhaal
   (contactpunt t.o.v. het lichaam, bladhoek, elleboogstrekking), en SVG houdt
   de fase-teksten leesbare DOM-tekst op pagina's die het van zoekverkeer
   moeten hebben.

   Een pose is een setje absolute segment-hoeken in graden.
   Hoekconventie: 0 = naar rechts, 90 = omlaag (SVG-y wijst naar beneden),
   dus -90 = recht omhoog. De speler kijkt naar rechts; het net staat rechts.
   ===================================================================== */
(function () {
  'use strict';

  var GROUND = 380;

  // Segmentlengtes van een figuur van ongeveer 170px hoog.
  var SEG = {
    torso: 64, neck: 16, headR: 14,
    thigh: 46, shin: 46,
    upperArm: 40, foreArm: 38,
    shaft: 26, head: 20
  };

  /* ---- Basis-poses. Slagen verwijzen hiernaar en overschrijven een handvol
     getallen; de hele bovenhandse familie deelt dezelfde ketting. ---- */
  var BASE = {
    READY: {
      hip: [300, 286], torso: -88, headTilt: -8,
      backThigh: 105, backShin: 79, frontThigh: 75, frontShin: 101,
      upperArm: -45, foreArm: -62, racket: -50,
      offUpper: -50, offFore: -62, ball: null
    },
    TROPHY: {
      hip: [292, 296], torso: -99, headTilt: 12,
      backThigh: 113, backShin: 70, frontThigh: 70, frontShin: 104,
      upperArm: -88, foreArm: -142, racket: 165,
      offUpper: -62, offFore: -48, ball: null
    },
    CONTACT_HIGH: {
      hip: [303, 284], torso: -87, headTilt: -6,
      backThigh: 103, backShin: 81, frontThigh: 77, frontShin: 98,
      upperArm: -78, foreArm: -72, racket: -66,
      offUpper: -18, offFore: 22, ball: null
    },
    FOLLOW_DOWN: {
      hip: [308, 290], torso: -74, headTilt: -4,
      backThigh: 112, backShin: 70, frontThigh: 68, frontShin: 104,
      upperArm: -8, foreArm: 48, racket: 92,
      offUpper: 44, offFore: 72, ball: null
    },
    RECOVER: {
      hip: [300, 287], torso: -89, headTilt: -4,
      backThigh: 104, backShin: 80, frontThigh: 76, frontShin: 100,
      upperArm: -42, foreArm: -60, racket: -48,
      offUpper: -46, offFore: -58, ball: null
    }
  };

  function pose(base, over) {
    var p = {}, k;
    for (k in base) if (base.hasOwnProperty(k)) p[k] = base[k];
    for (k in over) if (over.hasOwnProperty(k)) p[k] = over[k];
    return p;
  }

  /* ---- Slagdefinities ---- */
  var STROKES = {
    smash: {
      name: 'Smash',
      phases: [
        { id: 'klaar', label: 'Klaar', hold: 480, ms: 780, ease: 'inOut',
          text: 'Je ziet de lob komen. Racket omhoog, schouders beginnen te draaien.',
          pose: pose(BASE.READY, { ball: [470, 66] }) },
        { id: 'trofee', label: 'Trofee-positie', hold: 400, ms: 260, ease: 'in',
          text: 'Racket achter het hoofd, niet-slaande arm wijst naar de bal. Knie\u00ebn gebogen, gewicht achter.',
          pose: pose(BASE.TROPHY, { ball: [420, 118] }) },
        { id: 'contact', label: 'Contact', hold: 150, ms: 210, ease: 'out',
          text: 'Hoogste punt, net v\u00f3\u00f3r je hoofd. Niet erboven, niet erachter. De pols geeft de versnelling.',
          pose: pose(BASE.CONTACT_HIGH, { ball: [348, 100] }) },
        { id: 'doorzwaai', label: 'Doorzwaai', hold: 240, ms: 520, ease: 'out',
          text: 'Racket zwaait door naar beneden langs het lichaam. De bal vertrekt diagonaal, niet verticaal.',
          pose: pose(BASE.FOLLOW_DOWN, { ball: [566, 214] }) },
        { id: 'herstel', label: 'Herstel', hold: 900, ms: 620, ease: 'inOut',
          text: 'Direct terug in balans. Een smash die je uit positie slaat, kost je het volgende punt.',
          pose: pose(BASE.RECOVER, { ball: null }) }
      ]
    }
  };

  /* ---- Wiskunde ---- */
  var RAD = Math.PI / 180;
  function step(p, deg, len) {
    return [p[0] + Math.cos(deg * RAD) * len, p[1] + Math.sin(deg * RAD) * len];
  }
  var EASE = {
    lin: function (t) { return t; },
    in: function (t) { return t * t; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  };

  var ANGLE_KEYS = ['torso', 'headTilt', 'backThigh', 'backShin', 'frontThigh',
                    'frontShin', 'upperArm', 'foreArm', 'racket', 'offUpper', 'offFore'];

  function lerpPose(a, b, t) {
    var out = { hip: [a.hip[0] + (b.hip[0] - a.hip[0]) * t,
                      a.hip[1] + (b.hip[1] - a.hip[1]) * t] };
    for (var i = 0; i < ANGLE_KEYS.length; i++) {
      var k = ANGLE_KEYS[i];
      out[k] = a[k] + (b[k] - a[k]) * t;
    }
    // De bal verdwijnt uit beeld in plaats van naar 0,0 te springen zodra
    // een van beide poses hem niet definieert.
    if (a.ball && b.ball) {
      out.ball = [a.ball[0] + (b.ball[0] - a.ball[0]) * t,
                  a.ball[1] + (b.ball[1] - a.ball[1]) * t];
      out.ballAlpha = 1;
    } else if (a.ball) {
      out.ball = a.ball; out.ballAlpha = 1 - t;
    } else if (b.ball) {
      out.ball = b.ball; out.ballAlpha = t;
    } else {
      out.ball = null; out.ballAlpha = 0;
    }
    return out;
  }

  // Zet een pose om in alle punten die getekend moeten worden.
  function solve(p) {
    var hip = p.hip;
    var shoulder = step(hip, p.torso, SEG.torso);
    var head = step(shoulder, p.torso + p.headTilt, SEG.neck + SEG.headR);
    var backKnee = step(hip, p.backThigh, SEG.thigh);
    var frontKnee = step(hip, p.frontThigh, SEG.thigh);
    var elbow = step(shoulder, p.upperArm, SEG.upperArm);
    var hand = step(elbow, p.foreArm, SEG.foreArm);
    var shaftEnd = step(hand, p.racket, SEG.shaft);
    return {
      hip: hip, shoulder: shoulder, head: head,
      backKnee: backKnee, backFoot: step(backKnee, p.backShin, SEG.shin),
      frontKnee: frontKnee, frontFoot: step(frontKnee, p.frontShin, SEG.shin),
      elbow: elbow, hand: hand,
      shaftEnd: shaftEnd,
      racketHead: step(shaftEnd, p.racket, SEG.head),
      racketAngle: p.racket,
      offElbow: step(shoulder, p.offUpper, SEG.upperArm * 0.95),
      offHand: step(step(shoulder, p.offUpper, SEG.upperArm * 0.95), p.offFore, SEG.foreArm * 0.95),
      ball: p.ball, ballAlpha: p.ballAlpha == null ? 1 : p.ballAlpha
    };
  }

  /* ---- SVG ---- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function line(cls, w, cap) {
    return el('line', { class: cls, 'stroke-width': w, 'stroke-linecap': cap || 'round' });
  }
  function setLine(n, a, b) {
    n.setAttribute('x1', a[0]); n.setAttribute('y1', a[1]);
    n.setAttribute('x2', b[0]); n.setAttribute('y2', b[1]);
  }

  function buildScene(stroke) {
    // Bijgesneden kader: poses zijn uitgewerkt in een 640x420-ruimte, maar het
    // figuur beslaat daar maar een deel van. Croppen scheelt lege ruimte zonder
    // dat er ook maar een hoek herrekend hoeft te worden.
    var svg = el('svg', {
      viewBox: '150 30 440 375', class: 'sa-svg',
      role: 'img', 'aria-label': 'Zijaanzicht van de uitvoering van de ' + stroke.name
    });

    // Baan-context: grondlijn en een stuk net rechts, zodat de slagrichting klopt.
    svg.appendChild(el('line', { class: 'sa-ground', x1: 155, y1: GROUND, x2: 585, y2: GROUND }));
    svg.appendChild(el('line', { class: 'sa-net', x1: 556, y1: GROUND, x2: 556, y2: GROUND - 84 }));
    svg.appendChild(el('line', { class: 'sa-net-tape', x1: 538, y1: GROUND - 84, x2: 574, y2: GROUND - 84 }));

    var g = el('g', { class: 'sa-figure' });

    var refs = {};
    refs.trail = el('g', { class: 'sa-trail' });
    g.appendChild(refs.trail);

    refs.ballPath = el('path', { class: 'sa-ballpath', d: '', fill: 'none' });
    g.appendChild(refs.ballPath);

    // Achterste ledematen eerst, zodat de romp ervoor valt.
    refs.backThigh = line('sa-limb sa-limb-back', 7);
    refs.backShin = line('sa-limb sa-limb-back', 6);
    refs.offUpper = line('sa-limb sa-limb-back', 6);
    refs.offFore = line('sa-limb sa-limb-back', 5);
    [refs.backThigh, refs.backShin, refs.offUpper, refs.offFore].forEach(function (n) { g.appendChild(n); });

    refs.frontThigh = line('sa-limb', 8);
    refs.frontShin = line('sa-limb', 7);
    refs.torso = line('sa-torso', 11);
    refs.upperArm = line('sa-limb', 7);
    refs.foreArm = line('sa-limb', 6);
    [refs.frontThigh, refs.frontShin, refs.torso, refs.upperArm, refs.foreArm]
      .forEach(function (n) { g.appendChild(n); });

    refs.head = el('circle', { class: 'sa-head', r: SEG.headR });
    g.appendChild(refs.head);

    refs.shaft = line('sa-shaft', 4);
    refs.racket = el('ellipse', { class: 'sa-racket', rx: 13, ry: SEG.head });
    g.appendChild(refs.shaft);
    g.appendChild(refs.racket);

    refs.ball = el('circle', { class: 'sa-ball', r: 8 });
    refs.ballCore = el('circle', { class: 'sa-ball-core', r: 3 });
    g.appendChild(refs.ball);
    g.appendChild(refs.ballCore);

    svg.appendChild(g);
    refs.svg = svg;
    refs.group = g;
    return refs;
  }

  function draw(refs, p) {
    var s = solve(p);
    setLine(refs.backThigh, s.hip, s.backKnee);
    setLine(refs.backShin, s.backKnee, s.backFoot);
    setLine(refs.frontThigh, s.hip, s.frontKnee);
    setLine(refs.frontShin, s.frontKnee, s.frontFoot);
    setLine(refs.torso, s.hip, s.shoulder);
    setLine(refs.upperArm, s.shoulder, s.elbow);
    setLine(refs.foreArm, s.elbow, s.hand);
    setLine(refs.offUpper, s.shoulder, s.offElbow);
    setLine(refs.offFore, s.offElbow, s.offHand);
    setLine(refs.shaft, s.hand, s.shaftEnd);

    refs.head.setAttribute('cx', s.head[0]);
    refs.head.setAttribute('cy', s.head[1]);

    var rc = s.racketHead;
    refs.racket.setAttribute('cx', rc[0]);
    refs.racket.setAttribute('cy', rc[1]);
    refs.racket.setAttribute('transform', 'rotate(' + (s.racketAngle + 90) + ',' + rc[0] + ',' + rc[1] + ')');

    if (s.ball) {
      refs.ball.setAttribute('cx', s.ball[0]); refs.ball.setAttribute('cy', s.ball[1]);
      refs.ballCore.setAttribute('cx', s.ball[0]); refs.ballCore.setAttribute('cy', s.ball[1]);
      refs.ball.setAttribute('opacity', s.ballAlpha);
      refs.ballCore.setAttribute('opacity', s.ballAlpha);
    } else {
      refs.ball.setAttribute('opacity', 0);
      refs.ballCore.setAttribute('opacity', 0);
    }
    return s;
  }

  /* ---- Racketspoor: het detail dat de zwaai daadwerkelijk uitlegt ---- */
  var TRAIL_MAX = 16;
  function drawTrail(refs, pts) {
    var g = refs.trail;
    while (g.firstChild) g.removeChild(g.firstChild);
    for (var i = 1; i < pts.length; i++) {
      var seg = el('line', {
        class: 'sa-trail-seg',
        x1: pts[i - 1][0], y1: pts[i - 1][1], x2: pts[i][0], y2: pts[i][1],
        'stroke-width': 1.5 + (i / pts.length) * 3,
        opacity: (i / pts.length) * 0.55
      });
      g.appendChild(seg);
    }
  }

  /* ---- Afspelen ---- */
  function init(fig) {
    var key = fig.getAttribute('data-stroke');
    var stroke = STROKES[key];
    if (!stroke) return;

    var phases = stroke.phases;
    var refs = buildScene(stroke);

    var stage = document.createElement('div');
    stage.className = 'sa-stage';
    stage.appendChild(refs.svg);

    var badge = document.createElement('div');
    badge.className = 'sa-phase';
    stage.appendChild(badge);

    var controls = document.createElement('div');
    controls.className = 'sa-controls';

    var play = document.createElement('button');
    play.className = 'sa-play';
    play.type = 'button';
    controls.appendChild(play);

    var dots = document.createElement('div');
    dots.className = 'sa-dots';
    var dotEls = phases.map(function (ph, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sa-dot';
      b.title = ph.label;
      b.setAttribute('aria-label', 'Fase ' + (i + 1) + ': ' + ph.label);
      b.addEventListener('click', function () { stop(); showPhase(i); });
      dots.appendChild(b);
      return b;
    });
    controls.appendChild(dots);

    var caption = document.createElement('p');
    caption.className = 'sa-caption';

    // Bestaande figcaption blijft de toegankelijke omschrijving; hij komt
    // onderaan te staan.
    var existing = fig.querySelector('figcaption');
    fig.insertBefore(stage, existing || null);
    fig.insertBefore(controls, existing || null);
    fig.insertBefore(caption, existing || null);

    var trail = [];
    var raf = null, running = false, played = false;

    function setUI(i) {
      badge.textContent = (i + 1) + '/' + phases.length + ' \u00b7 ' + phases[i].label;
      caption.textContent = phases[i].text;
      dotEls.forEach(function (d, n) {
        d.classList.toggle('is-active', n === i);
        d.classList.toggle('is-done', n < i);
      });
    }

    function showPhase(i) {
      trail = [];
      drawTrail(refs, trail);
      draw(refs, phases[i].pose);
      setUI(i);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      play.classList.remove('is-playing');
      play.setAttribute('aria-label', 'Speel de ' + stroke.name.toLowerCase() + ' af');
    }

    function run() {
      running = true;
      played = true;
      play.classList.add('is-playing');
      play.setAttribute('aria-label', 'Pauzeer');
      trail = [];

      var idx = 0, t0 = null, phase = 'hold';

      function frame(now) {
        if (!running) return;
        if (t0 === null) t0 = now;
        var cur = phases[idx];
        var elapsed = now - t0;
        var p;

        if (phase === 'hold') {
          p = cur.pose;
          setUI(idx);
          if (elapsed >= cur.hold) { phase = 'move'; t0 = now; }
        } else {
          var next = phases[idx + 1];
          if (!next) { stop(); showPhase(phases.length - 1); return; }
          var t = Math.min(elapsed / cur.ms, 1);
          p = lerpPose(cur.pose, next.pose, EASE[cur.ease || 'inOut'](t));
          if (t >= 1) { idx++; phase = 'hold'; t0 = now; }
        }

        var s = draw(refs, p);

        // Spoor alleen tijdens de zwaai zelf, daarna uitfaden.
        if (idx >= 1 && idx <= 3) {
          trail.push(s.racketHead);
          while (trail.length > TRAIL_MAX) trail.shift();
        } else if (trail.length) {
          trail.shift();
        }
        drawTrail(refs, trail);

        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }

    play.addEventListener('click', function () {
      if (running) { stop(); } else { run(); }
    });

    // Statische startpose.
    showPhase(0);
    stop();

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Toon het moment dat er toe doet en speel niets automatisch af.
      showPhase(2);
      return;
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !played) run();
        });
      }, { threshold: 0.45 });
      io.observe(fig);
    }
  }

  function boot() {
    var figs = document.querySelectorAll('[data-stroke]');
    for (var i = 0; i < figs.length; i++) init(figs[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
