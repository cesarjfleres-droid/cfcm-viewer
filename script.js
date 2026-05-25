/* =================================================================
   CF&CM — Carte numérique La Maison Auberge
   Version : 2.0 (Production-ready, classes alignées avec style.css)
   ================================================================= */

/* ─────────────────────────────────────────────────────────────────
   ⚙️  CONFIGURATION
   ───────────────────────────────────────────────────────────────── */
// Viewer 3D local (même repo GitHub Pages)
const VIEWER_URL = 'viewer.html';

/* ─────────────────────────────────────────────────────────────────
   📋  Données du menu
   ───────────────────────────────────────────────────────────────── */
const MENU = [
  {
    section: 'Entrées',
    sectionNumber: 'I',
    items: [
      { id: 'foie-gras',      name: 'Foie gras maison',          desc: "Mi-cuit aux figues confites, pain brioché toasté, fleur de sel de Camargue.", price: 28, family: 'savory-warm', active: false },
      { id: 'tartare-saumon', name: 'Tartare de saumon',         desc: "Saumon d'Écosse au couteau, aneth, citron vert, huile de noisette.",         price: 22, family: 'seafood',     active: false },
      { id: 'veloute',        name: 'Velouté de potimarron',     desc: "Crème de châtaigne, copeaux de truffe d'automne, brioche dorée.",            price: 18, family: 'savory-warm', active: false },
      { id: 'st-jacques',     name: 'Carpaccio de Saint-Jacques',desc: "Saint-Jacques de plongée, vinaigrette yuzu, baies roses, micro-pousses.",    price: 32, family: 'seafood',     active: false },
      { id: 'homard',         name: 'Salade de homard breton',   desc: "Homard bleu rôti, pomme verte, mesclun, mayonnaise au corail.",              price: 38, family: 'fresh',       active: false },
    ],
  },
  {
    section: 'Plats',
    sectionNumber: 'II',
    items: [
      { id: 'rossini',  name: 'Filet de bœuf Rossini',         desc: "Filet charolais, escalope de foie gras poêlée, sauce Périgueux, pommes Anna.", price: 48, family: 'savory-deep', active: false },
      { id: 'loup-sel', name: 'Loup de mer en croûte de sel',  desc: "Loup sauvage de Méditerranée, fenouil confit, beurre blanc à l'estragon.",     price: 42, family: 'seafood',     active: false },
      { id: 'canard',   name: 'Magret de canard',              desc: "Canard du Sud-Ouest, sauce aux cerises noires, gratin dauphinois.",            price: 36, family: 'savory-deep', active: false },
      { id: 'risotto',  name: 'Risotto aux truffes',           desc: "Carnaroli crémeux, truffe noire du Périgord, parmesan affiné 24 mois.",        price: 44, family: 'savory-warm', active: false },
      { id: 'veau',     name: 'Côte de veau aux morilles',     desc: "Veau fermier, sauce aux morilles, gnocchi maison à la sauge.",                 price: 39, family: 'savory-deep', active: false },
      { id: 'volaille', name: 'Suprême de volaille',           desc: "Volaille fermière de Bresse, jus corsé, légumes glacés de saison.",            price: 34, family: 'savory-warm', active: false },
      { id: 'bar',      name: 'Bar grillé aux agrumes',        desc: "Bar de ligne, fenouil rôti, salsa d'agrumes, huile d'olive de Maussane.",      price: 40, family: 'seafood',     active: false },
      { id: 'agneau',   name: 'Agneau de Provence',            desc: "Carré d'agneau de Sisteron en croûte d'herbes, ratatouille fine, jus à l'ail confit.", price: 42, family: 'savory-deep', active: false },
    ],
  },
  {
    section: 'Fromages',
    sectionNumber: 'III',
    items: [
      { id: 'fromages', name: 'Plateau de fromages affinés', desc: "Sélection du maître affineur : sept fromages fermiers, confitures maison.", price: 18, family: 'savory-warm', active: false },
    ],
  },
  {
    section: 'Desserts',
    sectionNumber: 'IV',
    items: [
      // ⭐  LE SEUL PLAT ACTIF — démo fonctionnelle (Tarte aux fraises)
      { id: 'tarte-fraises', name: 'Tarte aux fraises',   desc: "Pâte sablée à la vanille, crème pâtissière, fraises de Carpentras, basilic frais.", price: 14, family: 'sweet', active: true },

      { id: 'souffle',       name: 'Soufflé au Grand Marnier', desc: "Soufflé minute à l'orange, sauce chocolat noir Valrhona 70%.",                price: 16, family: 'sweet', active: false },
      { id: 'creme-brulee',  name: 'Crème brûlée',             desc: "Crème onctueuse à la vanille de Madagascar, croûte de sucre cassonade.",       price: 12, family: 'sweet', active: false },
      { id: 'moelleux',      name: 'Moelleux au chocolat',     desc: "Cœur coulant chocolat noir, glace vanille bourbon, éclats de fève de cacao.",  price: 13, family: 'sweet', active: false },
      { id: 'mille-feuille', name: 'Mille-feuille tradition',  desc: "Feuilletage inversé, crème diplomate à la vanille, glaçage minute.",          price: 14, family: 'sweet', active: false },
      { id: 'ile-flottante', name: 'Île flottante',            desc: "Blancs en neige, crème anglaise, pralines roses, caramel à la fleur de sel.", price: 12, family: 'sweet', active: false },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────
   🎨  Icônes SVG
   ───────────────────────────────────────────────────────────────── */
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

const ICON_LOCK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
  </svg>
`;

const ICON_ORNAMENT = `
  <svg class="rule-ornament" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
    <circle cx="11" cy="11" r="3"></circle>
    <circle cx="11" cy="11" r="8" opacity="0.4"></circle>
  </svg>
`;

/* ─────────────────────────────────────────────────────────────────
   🛠  Helpers
   ───────────────────────────────────────────────────────────────── */
function formatPrice(price) {
  return `${price} €`;
}

function renderDish(dish, globalIndex) {
  const isActive = dish.active === true;
  const number = String(globalIndex + 1).padStart(2, '0');

  const buttonBlock = isActive
    ? `<button type="button" class="dish-cta dish-cta--active" data-dish="${dish.id}" aria-label="Voir la ${dish.name} en 3D">
         ${ICON_CUBE}
         <span class="cta-label">Voir en 3D</span>
         ${ICON_ARROW}
       </button>`
    : `<span class="dish-cta dish-cta--disabled" aria-disabled="true">
         ${ICON_LOCK}
         <span class="cta-label">Bientôt disponible</span>
       </span>`;

  const featuredClass = isActive ? 'dish-card--featured' : '';
  const initial = dish.name.charAt(0);

  return `
    <article class="dish-card ${featuredClass}" data-id="${dish.id}" data-family="${dish.family || 'sweet'}" data-reveal data-reveal-delay="${Math.min(globalIndex, 8)}">
      <span class="dish-number">${number}</span>
      <div class="dish-image-wrap">
        <div class="dish-image-placeholder">
          <span>${initial}</span>
        </div>
      </div>
      <div class="dish-body">
        <h3 class="dish-name">${dish.name}</h3>
        <p class="dish-desc">${dish.desc}</p>
        <div class="dish-footer">
          <span class="dish-price">${formatPrice(dish.price)}</span>
          ${buttonBlock}
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
      <div class="menu-grid">
        ${dishesHTML}
      </div>
    </section>
  `;
}

/* ─────────────────────────────────────────────────────────────────
   🚀  Initialisation
   ───────────────────────────────────────────────────────────────── */
function init() {
  try {
    const menuEl = document.getElementById('menu');
    if (!menuEl) {
      console.error('[CF&CM] Élément #menu introuvable dans le DOM');
      return;
    }

    // Génère le HTML en gardant un compteur global pour la numérotation
    let globalIndex = 0;
    const sectionsHTML = MENU.map(section => {
      const html = renderSection(section, globalIndex);
      globalIndex += section.items.length;
      return html;
    }).join('');

    menuEl.innerHTML = sectionsHTML;

    // Animation reveal au scroll
    initScrollReveal();

    // Branche les boutons 3D actifs
    const activeButtons = document.querySelectorAll('.dish-cta--active[data-dish]');
    activeButtons.forEach(btn => {
      btn.addEventListener('click', handleView3D);
    });

    console.log(`[CF&CM] Menu chargé : ${globalIndex} plats, ${activeButtons.length} actif(s) en 3D`);
  } catch (err) {
    console.error('[CF&CM] Erreur init :', err);
  }
}

function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -80px 0px', threshold: 0.05 }
  );

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}

function handleView3D(event) {
  try {
    const btn = event.currentTarget;
    const dishId = btn.getAttribute('data-dish');

    const separator = VIEWER_URL.includes('?') ? '&' : '?';
    const target = `${VIEWER_URL}${separator}dish=${encodeURIComponent(dishId)}`;

    // Feedback visuel avant redirection
    btn.style.transform = 'scale(0.97)';
    setTimeout(() => {
      window.location.href = target;
    }, 150);
  } catch (err) {
    console.error('[CF&CM] Erreur redirection 3D :', err);
  }
}

// Lance l'app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
