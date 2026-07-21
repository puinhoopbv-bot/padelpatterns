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

  // Moet hierboven staan, niet bij de rest van de wiskunde verderop: de
  // contactposes rekenen tijdens het opbouwen van STROKES al hun balpositie
  // uit, en een `var` die later staat is op dat moment nog undefined.
  var RAD = Math.PI / 180;

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
    },

    /* --- bandeja-familie: contact naast het hoofd, blad horizontaal --- */
    PREP_SIDE: {
      hip: [294, 292], torso: -95, headTilt: 8,
      backThigh: 110, backShin: 74, frontThigh: 72, frontShin: 102,
      upperArm: -80, foreArm: -118, racket: -170,
      offUpper: -58, offFore: -44, ball: null
    },
    CONTACT_SHOULDER: {
      hip: [302, 286], torso: -88, headTilt: -8,
      backThigh: 100, backShin: 84, frontThigh: 78, frontShin: 98,
      upperArm: -62, foreArm: -30, racket: 5,
      offUpper: -34, offFore: -20, ball: 'racket'
    },
    FOLLOW_ACROSS: {
      hip: [306, 286], torso: -82, headTilt: -6,
      backThigh: 100, backShin: 84, frontThigh: 78, frontShin: 98,
      upperArm: -28, foreArm: 18, racket: 40,
      offUpper: 18, offFore: 48, ball: null
    },

    /* --- lage en midden-slagen --- */
    READY_BASELINE: {
      hip: [300, 288], torso: -86, headTilt: -4,
      backThigh: 106, backShin: 78, frontThigh: 74, frontShin: 102,
      upperArm: -28, foreArm: -40, racket: -25,
      offUpper: -20, offFore: -38, ball: null
    },
    PREP_LOW: {
      hip: [290, 296], torso: -98, headTilt: 10,
      backThigh: 114, backShin: 70, frontThigh: 68, frontShin: 106,
      upperArm: 15, foreArm: -30, racket: -160,
      offUpper: -25, offFore: -5, ball: null
    },
    CONTACT_LOW: {
      hip: [305, 292], torso: -80, headTilt: -8,
      backThigh: 110, backShin: 74, frontThigh: 66, frontShin: 106,
      upperArm: 18, foreArm: 30, racket: -15,
      offUpper: -25, offFore: -45, ball: 'racket'
    },
    CONTACT_MID: {
      hip: [303, 287], torso: -84, headTilt: -6,
      backThigh: 104, backShin: 80, frontThigh: 74, frontShin: 100,
      upperArm: -20, foreArm: -5, racket: 5,
      offUpper: -38, offFore: -62, ball: 'racket'
    },
    FOLLOW_HIGH: {
      hip: [307, 284], torso: -86, headTilt: -12,
      backThigh: 100, backShin: 84, frontThigh: 76, frontShin: 100,
      upperArm: -62, foreArm: -52, racket: -42,
      offUpper: -34, offFore: -55, ball: null
    },
    FOLLOW_SHORT: {
      hip: [304, 287], torso: -84, headTilt: -5,
      backThigh: 103, backShin: 81, frontThigh: 75, frontShin: 100,
      upperArm: -26, foreArm: -14, racket: -2,
      offUpper: -36, offFore: -58, ball: null
    }
  };

  function pose(base, over) {
    var p = {}, k;
    for (k in base) if (base.hasOwnProperty(k)) p[k] = base[k];
    for (k in over) if (over.hasOwnProperty(k)) p[k] = over[k];
    return p;
  }

  // ball: 'racket' betekent "leg de bal op de snaren". Dat wordt eenmalig
  // uitgerekend uit de pose zelf, zodat het contactpunt nooit een paar pixels
  // naast het blad kan liggen doordat er een hoek is bijgesteld.
  function resolveBall(p) {
    if (p.ball !== 'racket') return p;
    var at = solve(p).racketHead;
    if (!isFinite(at[0]) || !isFinite(at[1])) {
      // Stil falen betekent hier: bal onzichtbaar op precies het frame dat de
      // slag moet uitleggen. Liever luidruchtig.
      throw new Error('stroke-animation: contactpunt onbepaald');
    }
    p.ball = at;
    return p;
  }

  /* ---- Slagdefinities ----
     Elke slag is vijf fasen. De teksten volgen de techniek-punten die al op de
     bijbehorende pagina staan, zodat animatie en artikel hetzelfde zeggen. ---- */
  function P(id, label, hold, ms, ease, text, p) {
    return { id: id, label: label, hold: hold, ms: ms, ease: ease, text: text,
             pose: resolveBall(p) };
  }

  var STROKES = {
    smash: {
      name: 'Smash',
      phases: [
        P('klaar', 'Klaar', 480, 780, 'inOut',
          'Je ziet de lob komen. Racket omhoog, schouders beginnen te draaien.',
          pose(BASE.READY, { ball: [470, 66] })),
        P('trofee', 'Trofee-positie', 400, 260, 'in',
          'Racket achter het hoofd, niet-slaande arm wijst naar de bal. Knie\u00ebn gebogen, gewicht achter.',
          pose(BASE.TROPHY, { ball: [420, 118] })),
        P('contact', 'Contact', 150, 210, 'out',
          'Hoogste punt, net v\u00f3\u00f3r je hoofd. Niet erboven, niet erachter. De pols geeft de versnelling.',
          pose(BASE.CONTACT_HIGH, { ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 240, 520, 'out',
          'Racket zwaait door naar beneden langs het lichaam. De bal vertrekt diagonaal, niet verticaal.',
          pose(BASE.FOLLOW_DOWN, { ball: [566, 214] })),
        P('herstel', 'Herstel', 900, 620, 'inOut',
          'Direct terug in balans. Een smash die je uit positie slaat, kost je het volgende punt.',
          pose(BASE.RECOVER, {}))
      ]
    },

    bandeja: {
      name: 'Bandeja',
      phases: [
        P('klaar', 'Klaar', 480, 760, 'inOut',
          'De lob komt. Je draait je schouders en stapt zijwaarts achteruit, niet met je rug naar het net.',
          pose(BASE.READY, { ball: [470, 78] })),
        P('voorbereiding', 'Voorbereiding', 380, 300, 'in',
          'Racket omhoog naast je hoofd, niet erachter. Lager dan bij een smash: dit wordt geen krachtslag.',
          pose(BASE.PREP_SIDE, { ball: [424, 128] })),
        P('contact', 'Contact', 170, 230, 'out',
          'Contact naast je hoofd, op schouderhoogte. Het racketblad blijft horizontaal, dat houdt de bal vlak.',
          pose(BASE.CONTACT_SHOULDER, { ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 240, 480, 'out',
          'Doorzwaai naar voren en zijwaarts, niet omlaag. Je mikt op de hoek bij de zijwand.',
          pose(BASE.FOLLOW_ACROSS, { ball: [578, 176] })),
        P('herstel', 'Herstel', 900, 600, 'inOut',
          'Je blijft in beweging naar het net. De bandeja is een overgangsslag, geen eindpunt.',
          pose(BASE.RECOVER, {}))
      ]
    },

    vibora: {
      name: 'V\u00edbora',
      phases: [
        P('klaar', 'Klaar', 460, 740, 'inOut',
          'Zelfde uitgangspositie als de bandeja. Het verschil zit in wat je er straks mee doet.',
          pose(BASE.READY, { ball: [470, 72] })),
        P('voorbereiding', 'Voorbereiding', 360, 280, 'in',
          'Racket iets hoger dan bij de bandeja, en verder naar rechts. Je gaat de bal snijden, niet dragen.',
          pose(BASE.PREP_SIDE, { upperArm: -84, foreArm: -126, ball: [422, 120] })),
        P('contact', 'Contact', 160, 200, 'out',
          'Het racket snijdt schuin over de bal, van buiten naar binnen. Dat geeft de zijwaartse spin.',
          pose(BASE.CONTACT_SHOULDER, { upperArm: -68, foreArm: -38, racket: -14, ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 220, 440, 'out',
          'Korte, scherpe doorzwaai langs het lichaam. De bal blijft laag en schiet weg naar de zijkant.',
          pose(BASE.FOLLOW_ACROSS, { foreArm: 28, racket: 55, ball: [580, 198] })),
        P('herstel', 'Herstel', 880, 580, 'inOut',
          'Mix hem met de bandeja, ongeveer dertig om zeventig. Alleen v\u00edbora slaan maakt je leesbaar.',
          pose(BASE.RECOVER, {}))
      ]
    },

    rulo: {
      name: 'Rulo',
      phases: [
        P('klaar', 'Klaar', 470, 760, 'inOut',
          'Een rulo begint als een gewone smash. Pas op het laatste moment wijkt hij af.',
          pose(BASE.READY, { ball: [470, 66] })),
        P('trofee', 'Trofee-positie', 380, 260, 'in',
          'Volle trofee-positie. Voor de rulo heb je racketsnelheid nodig, dus geen halve voorbereiding.',
          pose(BASE.TROPHY, { ball: [420, 116] })),
        P('contact', 'Contact', 160, 210, 'out',
          'Je borstelt over de bovenkant van de bal in plaats van erdoorheen. Dat is de topspin die hem laat duiken.',
          pose(BASE.CONTACT_HIGH, { foreArm: -62, racket: -40, ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 240, 540, 'out',
          'Lange doorzwaai naar beneden en over. De bal stuitert hard, raakt het glas onder de rand en rolt zijwaarts weg.',
          pose(BASE.FOLLOW_DOWN, { foreArm: 62, racket: 108, ball: [556, 236] })),
        P('herstel', 'Herstel', 900, 620, 'inOut',
          'Pas aan de rulo beginnen als je basis-smash al zes van de tien keer goed landt.',
          pose(BASE.RECOVER, {}))
      ]
    },

    gancho: {
      name: 'Gancho',
      phases: [
        P('klaar', 'Klaar', 470, 760, 'inOut',
          'De lob gaat naar je backhand-kant. Je draait verder door dan bij een bandeja.',
          pose(BASE.READY, { upperArm: -62, foreArm: -88, racket: -80, ball: [462, 74] })),
        P('voorbereiding', 'Voorbereiding', 380, 290, 'in',
          'Schouder onder de bal, racket achter je backhand-schouder. Je rug staat half naar het net.',
          pose(BASE.PREP_SIDE, { torso: -103, upperArm: -96, foreArm: -150, racket: 150, ball: [420, 124] })),
        P('contact', 'Contact', 170, 220, 'out',
          'Contact boven je backhand-schouder. De pols haakt naar buiten, daar komt de naam vandaan.',
          pose(BASE.CONTACT_SHOULDER, { torso: -92, upperArm: -74, foreArm: -46, racket: -22, ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 230, 470, 'out',
          'De bal draait weg van je tegenstander richting de zijwand. Een backhand-bandeja gaat rechtdoor, deze niet.',
          pose(BASE.FOLLOW_ACROSS, { racket: 30, ball: [574, 192] })),
        P('herstel', 'Herstel', 880, 600, 'inOut',
          'Bouw hem pas als je backhand-bandeja staat. De gancho is een toplaag op een fundament.',
          pose(BASE.RECOVER, {}))
      ]
    },

    bajada: {
      name: 'Bajada',
      backGlass: true,
      phases: [
        P('klaar', 'Klaar', 470, 720, 'inOut',
          'De bal gaat over je heen richting het glas. Je draait mee en loopt met de bal naar achteren.',
          pose(BASE.READY, { upperArm: -40, foreArm: -60, racket: -50, ball: [372, 108] })),
        P('wachten', 'Laat het glas werken', 520, 300, 'inOut',
          'Je wacht de stuit af. Na het glas is het een nieuwe bal: trager, lager en voorspelbaar.',
          pose(BASE.PREP_LOW, { hip: [286, 294], ball: [208, 248] })),
        P('contact', 'Contact', 170, 240, 'out',
          'Contact op heup- tot borsthoogte, gewicht naar voren. Je slaat m\u00e9t de bal mee het veld weer in.',
          pose(BASE.CONTACT_MID, { ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 230, 480, 'out',
          'Vlakke doorzwaai naar voren. Geen winner forceren: dit is je uitweg uit de verdediging.',
          pose(BASE.FOLLOW_SHORT, { upperArm: -34, foreArm: -28, racket: -18, ball: [572, 212] })),
        P('herstel', 'Herstel', 900, 620, 'inOut',
          'En dan naar voren. De bajada is pas geslaagd als je er het net mee wint.',
          pose(BASE.RECOVER, {}))
      ]
    },

    chiquita: {
      name: 'Chiquita',
      phases: [
        P('klaar', 'Klaar', 470, 740, 'inOut',
          'Comfortabele bal achterin. Je instinct zegt hard slaan; dat is precies wat je niet doet.',
          pose(BASE.READY_BASELINE, { ball: [524, 232] })),
        P('voorbereiding', 'Voorbereiding', 380, 300, 'in',
          'Racket kort naar achteren en laag. Korte voorbereiding, want een lange zwaai maakt hem te hard.',
          pose(BASE.PREP_LOW, { ball: [404, 268] })),
        P('contact', 'Contact', 180, 230, 'out',
          'Contact laag en v\u00f3\u00f3r je, met een licht open blad. Geen kracht, alleen richting.',
          pose(BASE.CONTACT_LOW, { ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 240, 420, 'out',
          'Nauwelijks doorzwaai. De bal moet net over het net en dan dood naar beneden, op hun voeten.',
          pose(BASE.FOLLOW_SHORT, { upperArm: 2, foreArm: 6, racket: -10, ball: [572, 302] })),
        P('herstel', 'Herstel', 900, 600, 'inOut',
          'Direct doorlopen naar voren. De chiquita is een uitnodiging om het net te pakken.',
          pose(BASE.RECOVER, {}))
      ]
    },

    globo: {
      name: 'Globo',
      phases: [
        P('klaar', 'Klaar', 470, 740, 'inOut',
          'Kijk eerst naar hun voeten. Hielen tegen het net is het perfecte lob-moment.',
          pose(BASE.READY_BASELINE, { ball: [522, 246] })),
        P('voorbereiding', 'Voorbereiding', 370, 300, 'in',
          'Racket laag en onder de baan van de bal. Je gaat hem optillen, niet wegslaan.',
          pose(BASE.PREP_LOW, { ball: [400, 282] })),
        P('contact', 'Contact', 170, 240, 'out',
          'Contact onder de bal met een open blad. Dezelfde slag als een drive, alleen anders gericht.',
          pose(BASE.CONTACT_LOW, { racket: -32, ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 250, 520, 'out',
          'Hoge doorzwaai. Diep mikken, achter hun hoofd: een korte lob is een cadeau.',
          pose(BASE.FOLLOW_HIGH, { ball: [556, 62] })),
        P('herstel', 'Herstel', 900, 600, 'inOut',
          'En meteen naar voren. De lob is een aanval, geen vlucht.',
          pose(BASE.RECOVER, {}))
      ]
    },

    contralob: {
      name: 'Contralob',
      backGlass: true,
      phases: [
        P('klaar', 'Klaar', 470, 740, 'inOut',
          'Je staat onder druk achterin. Zij hebben het net en wachten op je fout.',
          pose(BASE.READY_BASELINE, { hip: [294, 290], ball: [528, 234] })),
        P('voorbereiding', 'Voorbereiding', 380, 300, 'in',
          'Vaak na een glas-stuit. Racket laag, lichaam gestrekt, je pakt de bal op het laatste moment.',
          pose(BASE.PREP_LOW, { hip: [286, 296], ball: [402, 288] })),
        P('contact', 'Contact', 180, 250, 'out',
          'Contact laag en uitgestrekt. Blad ver open, want deze bal moet hoog en diep.',
          pose(BASE.CONTACT_LOW, { hip: [300, 294], racket: -38, ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 250, 520, 'out',
          'Hoog doorzwaaien. Geen redmiddel maar een reset-knop: je zet de rally weer gelijk.',
          pose(BASE.FOLLOW_HIGH, { ball: [552, 70] })),
        P('herstel', 'Herstel', 900, 600, 'inOut',
          'Terug in positie en opnieuw beginnen. Geduld is hier een offensief wapen.',
          pose(BASE.RECOVER, {}))
      ]
    },

    volea: {
      name: 'Volea',
      phases: [
        P('klaar', 'Klaar', 460, 700, 'inOut',
          'Je staat aan het net, racket voor je op borsthoogte. Handen klaar, geen zwaai in gedachten.',
          pose(BASE.READY_BASELINE, { upperArm: -34, foreArm: -48, racket: -20, ball: [540, 204] })),
        P('voorbereiding', 'Voorbereiding', 300, 240, 'in',
          'Nauwelijks naar achteren. Alleen je schouder draait mee; de bal heeft zijn snelheid al.',
          pose(BASE.READY_BASELINE, { torso: -90, upperArm: -44, foreArm: -70, racket: -46, ball: [432, 202] })),
        P('contact', 'Contact', 160, 200, 'out',
          'Kort blokkeren v\u00f3\u00f3r je lichaam. Tachtig procent van je volleys hoort controle te zijn, geen winner.',
          pose(BASE.CONTACT_MID, { ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 230, 400, 'out',
          'Korte duw naar voren en diep. Placering wint hier van kracht, elke keer.',
          pose(BASE.FOLLOW_SHORT, { ball: [578, 238] })),
        P('herstel', 'Herstel', 880, 560, 'inOut',
          'Racket direct terug in het midden. Aan het net krijg je de volgende bal sneller dan je denkt.',
          pose(BASE.RECOVER, { upperArm: -34, foreArm: -48, racket: -20 }))
      ]
    },

    dejada: {
      name: 'Dejada',
      phases: [
        P('klaar', 'Klaar', 460, 700, 'inOut',
          'Zelfde houding als elke andere volley. Als ze zien dat je iets anders van plan bent, werkt hij niet.',
          pose(BASE.READY_BASELINE, { upperArm: -34, foreArm: -48, racket: -20, ball: [536, 208] })),
        P('voorbereiding', 'Voorbereiding', 300, 250, 'in',
          'Geen extra voorbereiding. Precies dezelfde aanzet als een diepe volley, tot het laatste moment.',
          pose(BASE.READY_BASELINE, { torso: -89, upperArm: -42, foreArm: -66, racket: -42, ball: [430, 206] })),
        P('contact', 'Contact', 190, 230, 'out',
          'Je vangt de bal op met een open blad en laat je hand meegeven. De snelheid moet eruit.',
          pose(BASE.CONTACT_MID, { racket: -30, ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 250, 420, 'out',
          'Vrijwel geen doorzwaai. De bal valt net over het net en stuitert twee keer voordat zij er zijn.',
          pose(BASE.FOLLOW_SHORT, { upperArm: -22, foreArm: -12, racket: -22, ball: [548, 322] })),
        P('herstel', 'Herstel', 900, 580, 'inOut',
          'E\u00e9n keer per wedstrijd, op het juiste moment. Vaker en het verrassingseffect is weg.',
          pose(BASE.RECOVER, { upperArm: -34, foreArm: -48, racket: -20 }))
      ]
    },

    saque: {
      name: 'Saque',
      phases: [
        P('klaar', 'Klaar', 520, 640, 'inOut',
          'Achter de servicelijn, bal in je vrije hand. Je kiest je plek al voordat je stuitert.',
          pose(BASE.READY_BASELINE, { upperArm: -18, foreArm: -34, racket: -18,
                                      offUpper: 18, offFore: 22, ball: [340, 262] })),
        P('stuit', 'Stuit', 420, 300, 'in',
          'De bal moet eerst stuiteren en onder heuphoogte geraakt worden. Dat is geen stijl, dat is de regel.',
          pose(BASE.PREP_LOW, { offUpper: 30, offFore: 46, ball: [346, 370] })),
        P('contact', 'Contact', 170, 230, 'out',
          'Contact onder je heup, met een vlak blad. Niet hard, wel gericht: je stuurt hun retour.',
          pose(BASE.CONTACT_LOW, { racket: -10, ball: 'racket' })),
        P('doorzwaai', 'Doorzwaai', 240, 460, 'out',
          'Doorzwaai richting de kruising. Een opslag naar het glas dwingt een voorspelbare retour af.',
          pose(BASE.FOLLOW_SHORT, { upperArm: -16, foreArm: -6, racket: -12, ball: [578, 276] })),
        P('herstel', 'Herstel', 900, 600, 'inOut',
          'En direct naar voren. Opslaan en blijven staan verliest je opslag-games.',
          pose(BASE.RECOVER, {}))
      ]
    }
  };

  /* ---- Wiskunde ---- */
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

    // Slagen die van de achterwand af gespeeld worden hebben die wand nodig,
    // anders komt de bal uit het niets terug.
    if (stroke.backGlass) {
      svg.appendChild(el('rect', { class: 'sa-glass', x: 168, y: GROUND - 196, width: 12, height: 196 }));
      svg.appendChild(el('line', { class: 'sa-glass-edge', x1: 180, y1: GROUND - 196, x2: 180, y2: GROUND }));
    }

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
