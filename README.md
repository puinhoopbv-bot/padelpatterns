# Padel Patterns

Tactical 3D visualization tool for padel strategies. Interactive court with smooth animated rallies, multiple camera angles, and sandbox mode for building your own formations.

## Live

https://padelpatterns.com

## Wat is het

Padel Patterns is een interactieve leertool voor padelspelers en coaches. Selecteer een tactische strategie uit de bibliotheek (bandeja, víbora, lob → take net, chiquita, en meer) en zie de hele rally afgespeeld als een vloeiende 3D-film met spelers, balbanen en cameraperspectieven.

In sandbox-modus sleep je spelers en de bal vrij over de baan om je eigen formaties op te bouwen.

## Hoe het werkt

Eén HTML-bestand. Three.js wordt geladen vanaf CDN. Geen build-stap, geen dependencies om te installeren. Open `index.html` in een moderne browser en het werkt.

## Hosting

Gehost op Vercel, gekoppeld aan deze GitHub-repository. Domein beheerd via TransIP. Elke push naar `main` wordt automatisch gepubliceerd.

## Lokale ontwikkeling

```bash
# Open simpelweg index.html in je browser, of start een lokale server:
python -m http.server 8000
# Bezoek dan http://localhost:8000
```

## Strategieën in v0.1

- Het Onzichtbare Touw (la cuerda invisible)
- De Drie Zones (rojo · naranja · verde)
- De Middenbal (la bola del medio)
- Lob → Net Veroveren (globo y subir)
- Chiquita
- Bandeja
- Serve & First Volley (saque y primera volea)
- X3 — Por Tres
- Víbora
- Bajada
- De Poach Trap (la trampa cruzada)
- Contralob (el contraglobo)

## Roadmap

- Meertalig: Engels, Spaans, Nederlands
- Meer strategieën (rulo, gancho, x4, double-poach)
- Drill-modus met beslismomenten
- Real match analyses (Premier Padel rally breakdowns)
- Stuit-fysica op het achterglas voor de bajada
- Geluid en haptische feedback

## Credits

Ontwikkeld door [Mark Poirter]. Gebouwd met three.js. Inhoud op basis van moderne padel coaching literatuur (FIP, The Padel School, Babolat, en eigen onderzoek).
