/* =================================================================
   CF&CM — Carte numérique Baia Bella
   Vraie carte du restaurant (transcrite des photos) :
   8 sections · 33 plats · badges régime · mentions de prix.
   Plats 3D actifs : La Baia (plat1), Scampis (plat2), Fresca (plat3).
   ================================================================= */

/* ⚙️  Viewer 3D — incrémenter à chaque déploiement (cache) */
const VIEWER_VERSION = '27';
const VIEWER_URL = 'viewer.html';

/* 📋  Carte — model: 'platX' active le bouton 3D */
const MENU = [
  {
    section: 'À partager', sectionNumber: 'I',
    items: [
      { id: 'pimientos',     name: 'Pimientos de Padrón',     desc: "Petits poivrons verts frits à l'huile d'olive.", price: 15, veg: true, gf: true },
      { id: 'barbajuan',     name: 'Barbajuan sauce tomate',  desc: "Raviolis frits farcis à la blette et fromage.", price: 17, veg: true },
      { id: 'ktipiti',       name: 'Ktipiti',                 desc: "Crème de poivrons grillés, fromage fêta, yaourt, huile d'olive, menthe fraîche et pain comme une pita.", price: 16, veg: true },
      { id: 'stracciatella', name: 'Stracciatella crémeuse',  desc: "Le cœur de mozzarella crémeuse, tomates colorées, basilic frais et charbon végétal.", price: 21.5, veg: true, gf: true },
      { id: 'coquillages',   name: 'Poêlée de coquillages',   desc: "Palourdes et moules au vin blanc, persillade.", price: 23.5, gf: true },
      { id: 'ceviche',       name: 'Ceviche Paloma',          desc: "Daurade marinée aux agrumes et pickles de légumes.", price: 28, gf: true },
    ],
  },
  {
    section: 'Salades', sectionNumber: 'II',
    items: [
      { id: 'la-baia',    name: 'La Baia',                       desc: "Pastèque, fromage fêta, tomate, melon, roquette, trait de balsamique, menthe fraîche.", price: 25, veg: true, gf: true, model: 'plat1' },
      { id: 'artichaut',  name: "La traditionnelle d'artichaut", desc: "Artichauts frais coupés finement, roquette, copeaux de parmesan, sauce ancholade légère.", price: 23, gf: true },
      { id: 'caesar',     name: "L'autre caesar",                desc: "Crevettes marinées, salade romaine, sauce caesar, noisettes torréfiées, copeaux de parmesan, tomates cerises, petits croûtons.", price: 27.5 },
      { id: 'vegan',      name: 'La pause vegan',                desc: "Jeunes pousses d'épinard, avocat, pois chiches, betteraves crues, mélange de graines, houmous, grenade, sauce soja cacahuète.", price: 24, veg: true, gf: true },
      { id: 'chavignol',  name: "Salade crottin de Chavignol & copeaux de truffes d'été", desc: "Tuber aestivum, asperges vertes, artichauts crus, roquette, ancholade légère.", price: 28.5 },
    ],
  },
  {
    section: 'Pizzas', sectionNumber: 'III',
    subtitle: "Nous réalisons nos pâtes à pizza, recette authentique de Luigi Vannini.",
    items: [
      { id: 'margarita', name: 'Authentique Margarita', desc: "Sauce tomate, mozzarella di Bufala, feuilles de basilic frais.", price: 19, veg: true },
      { id: 'gamberoni', name: 'Gamberoni',             desc: "Sauce tomate, mozzarella di Bufala, crevettes, persillade.", price: 26 },
      { id: 'picante',   name: 'Picante',               desc: "Sauce tomate, mozzarella, cantal, salami piquant, oignons rouges crus, poivrons rouges grillés.", price: 21 },
      { id: 'fresca',    name: 'Fresca',                desc: "Pâte blanche garnie à la sortie du four de tomates fraîches de couleur, jambon cru et mozzarella stracciatella.", price: 24, model: 'plat3' },
      { id: 'berlugane', name: 'Berlugane love',        desc: "Pâte blanche, mozzarella, cantal, aubergines confites, artichauts frais, garnie à la sortie du four de noisettes torréfiées, ricotta et basilic frais.", price: 22, veg: true },
      { id: 'tartufa',   name: 'Tartufa',               desc: "Pâte blanche, mozzarella, cantal, garnie à la sortie du four de salade roquette et lamelles de truffe d'été Tuber Aestivum.", price: 27, veg: true },
    ],
  },
  {
    section: 'Pâtes', sectionNumber: 'IV',
    subtitle: "Nos pâtes fraîches sont réalisées quotidiennement et artisanalement.",
    items: [
      { id: 'gnocchi',   name: 'Gnocchi frais alla Sorrentina', desc: "Gnocchi, sauce tomate maison, cœur de stracciatella onctueuse.", price: 23.5, veg: true },
      { id: 'rigatoni',  name: 'Rigatoni frais à la truffe',    desc: "Rigatoni à la crème de truffe et copeaux de truffes d'été Tuber Aestivum.", price: 27, veg: true },
      { id: 'linguini',  name: 'Linguini aux coquillages',      desc: "Linguini aux palourdes et aux moules, persillade et neige de poutargue.", price: 28 },
      { id: 'langouste', name: 'Pâtes à la langouste',          desc: "Pâtes à la crème, bisque de langouste et queue de langouste.", price: 56 },
    ],
  },
  {
    section: 'Poissons grillés au charbon de bois', sectionNumber: 'V',
    items: [
      { id: 'daurade-pesto', name: 'Daurade aux deux pesto façon Baia Bella', desc: "Cuite au charbon de bois, ouverte en portefeuille avec duo de pesto rouge et de pesto vert, légumes grillés et salade d'herbes folles.", price: 40, gf: true },
      { id: 'loup-entier',   name: 'Loup grillé entier cuit au charbon de bois', desc: "Pour deux personnes, pomme de terre en robe des champs et légumes grillés.", price: 49, note: '/ pers', gf: true },
      { id: 'scampis',       name: 'Scampis sauvages rôtis', desc: "Cuits au four, pomme de terre en robe des champs et légumes grillés.", price: 39.5, gf: true, model: 'plat2' },
      { id: 'rascasse',      name: 'Filet de rascasse', desc: "Cuit à la plancha, purée de petits pois froide, salade d'herbes folles et huile au paprika fumé.", price: 35, gf: true },
    ],
  },
  {
    section: 'La pêche selon arrivage', sectionNumber: 'VI',
    subtitle: "Les poissons de plus de deux personnes sont vendus au poids — prix pour 100 g.",
    items: [
      { id: 'peche-loup',    name: 'Loup · Sea bass',                desc: "Grillé entier au charbon de bois, selon l'arrivage du jour.", price: 12, note: '/ 100 g', gf: true },
      { id: 'peche-chapon',  name: 'Chapon · Scorpion fish',         desc: "Grillé entier au charbon de bois, selon l'arrivage du jour.", price: 15, note: '/ 100 g', gf: true },
      { id: 'peche-daurade', name: 'Daurade Royale · Royal Seabream', desc: "Grillée entière au charbon de bois, selon l'arrivage du jour.", price: 12, note: '/ 100 g', gf: true },
    ],
  },
  {
    section: 'Viandes grillées au charbon de bois', sectionNumber: 'VII',
    items: [
      { id: 'tartare',  name: 'Tartare de bœuf traditionnel', desc: "Pommes de terre et salade.", price: 28, gf: true },
      { id: 'filet',    name: 'Filet de bœuf à la braise',    desc: "Origine France, jus court au romarin, légumes grillés et panisses artisanales (environ 250 g).", price: 45 },
      { id: 'coquelet', name: 'Demi-coquelet à la braise',    desc: "Marinade au chimichurri rouge, pomme de terre en robe des champs, légumes grillés.", price: 29.5 },
      { id: 'tomahawk', name: 'Tomahawk de bœuf',             desc: "Environ 1,3 kg, cuit à la braise. Pomme de terre en robe des champs et légumes grillés.", price: 165, note: '2–3 pers', gf: true },
    ],
  },
  {
    section: 'Menu enfant', sectionNumber: 'VIII',
    subtitle: "Jusqu'à 11 ans.",
    items: [
      { id: 'enfant', name: 'Menu enfant', desc: "Steak haché, frites et légumes — ou — mini pizza marguerite sauce tomate, mozzarella, cantal — et une boule de glace au choix pour les plus sages.", price: 16 },
    ],
  },
];

/* 🎨  Icônes SVG */
const ICON_CUBE = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
`;
const ICON_ARROW = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
`;

/* 🛠  Helpers */
function formatPrice(price, note) {
  const main = price.toLocaleString('fr-FR', {
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${main}\u00A0€${note ? ` <span class="price-note">${note}</span>` : ''}`;
}

function buildViewerUrl(model) {
  const params = new URLSearchParams({ dish: model, v: VIEWER_VERSION });
  return `${VIEWER_URL}?${params.toString()}`;
}

function renderDish(dish, globalIndex) {
  const has3D = Boolean(dish.model);

  const badges = [
    dish.veg ? `<span class="badge badge--veg">Végétarien</span>` : '',
    dish.gf ? `<span class="badge badge--gf">Sans gluten</span>` : '',
  ].filter(Boolean).join('');

  const cta = has3D
    ? `<a class="dish-cta" href="${buildViewerUrl(dish.model)}" aria-label="Voir ${dish.name} en 3D">
         ${ICON_CUBE}
         <span class="cta-label">Voir en 3D</span>
         ${ICON_ARROW}
       </a>`
    : '';

  return `
    <article class="dish-card ${has3D ? 'dish-card--featured' : ''}" data-id="${dish.id}" data-reveal style="--reveal-delay:${Math.min(globalIndex % 9, 8)}">
      <div class="dish-body">
        <h3 class="dish-name">${dish.name}</h3>
        <p class="dish-desc">${dish.desc}</p>
        ${badges ? `<div class="dish-badges">${badges}</div>` : ''}
        <div class="dish-footer">
          <span class="dish-price">${formatPrice(dish.price, dish.note)}</span>
          ${cta}
        </div>
      </div>
    </article>
  `;
}

function renderSection(section, startIndex) {
  const dishesHTML = section.items
    .map((dish, i) => renderDish(dish, startIndex + i))
    .join('');
  return `
    <section class="menu-section" aria-labelledby="sec-${section.sectionNumber}">
      <header class="section-header" data-reveal>
        <span class="section-number">${section.sectionNumber}</span>
        <h2 class="section-title" id="sec-${section.sectionNumber}">${section.section}</h2>
      </header>
      ${section.subtitle ? `<p class="section-sub" data-reveal>${section.subtitle}</p>` : ''}
      <div class="menu-grid">${dishesHTML}</div>
    </section>
  `;
}

/* 🚀  Initialisation */
function init() {
  try {
    const menuEl = document.getElementById('menu');
    if (!menuEl) { console.error('[CF&CM] #menu introuvable'); return; }

    let globalIndex = 0;
    const sectionsHTML = MENU.map(section => {
      const html = renderSection(section, globalIndex);
      globalIndex += section.items.length;
      return html;
    }).join('');
    menuEl.innerHTML = sectionsHTML;

    initScrollReveal();

    console.log(`[CF&CM Baia Bella] Carte chargée : ${globalIndex} plats · viewer v${VIEWER_VERSION}`);
  } catch (err) {
    console.error('[CF&CM] Erreur init :', err);
  }
}

function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}

/* Reveal immédiat du header au chargement */
window.addEventListener('load', () => {
  document.querySelectorAll('.restaurant-hero [data-reveal]')
    .forEach(el => setTimeout(() => el.classList.add('is-visible'), 80));
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
