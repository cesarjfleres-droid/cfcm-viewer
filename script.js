/* =================================================================
   CF&CM — Carte numérique
   Logique : injection des plats + gestion du bouton 3D
   ================================================================= */

/* ─────────────────────────────────────────────────────────────────
   ⚙️  CONFIGURATION FACILEMENT MODIFIABLE
   ─────────────────────────────────────────────────────────────────
   Pour rediriger vers un autre viewer, modifiez simplement la
   constante VIEWER_URL ci-dessous. Vous pouvez aussi pointer vers
   un fichier local : 'viewer.html?dish=fraise'
   ───────────────────────────────────────────────────────────────── */
const VIEWER_URL = 'https://cfcm-viewer.pages.dev';
// const VIEWER_URL = 'viewer.html?dish=fraise';   // ← alternative locale

/* ─────────────────────────────────────────────────────────────────
   📋  Données de la carte
   ─────────────────────────────────────────────────────────────────
   - id        : identifiant unique du plat
   - name      : nom affiché
   - desc      : courte description (≈ 60–100 caractères)
   - price     : prix en euros
   - active    : true → bouton 3D actif | false → bouton désactivé
   ───────────────────────────────────────────────────────────────── */
const MENU = [
  {
    section: 'Entrées',
    sectionNumber: 'I',
    items: [
      { id: 'foie-gras',    name: 'Foie gras maison',        desc: 'Mi-cuit aux figues confites, pain brioché toasté, fleur de sel de Camargue.', price: 28, active: false },
      { id: 'tartare-saumon', name: 'Tartare de saumon',     desc: 'Saumon d\'Écosse au couteau, aneth, citron vert, huile de noisette.',          price: 22, active: false },
      { id: 'veloute',      name: 'Velouté de potimarron',   desc: 'Crème de châtaigne, copeaux de truffe d\'automne, brioche dorée.',             price: 18, active: false },
      { id: 'st-jacques',   name: 'Carpaccio de Saint-Jacques', desc: 'Saint-Jacques de plongée, vinaigrette yuzu, baies roses, micro-pousses.',   price: 32, active: false },
      { id: 'homard',       name: 'Salade de homard breton', desc: 'Homard bleu rôti, pomme verte, mesclun, mayonnaise au corail.',                price: 38, active: false },
    ],
  },
  {
    section: 'Plats',
    sectionNumber: 'II',
    items: [
      { id: 'rossini',      name: 'Filet de bœuf Rossini',   desc: 'Filet charolais, escalope de foie gras poêlée, sauce Périgueux, pommes Anna.',  price: 48, active: false },
      { id: 'loup-sel',     name: 'Loup de mer en croûte de sel', desc: 'Loup sauvage de Méditerranée, fenouil confit, beurre blanc à l\'estragon.',price: 42, active: false },
      { id: 'canard',       name: 'Magret de canard',        desc: 'Canard du Sud-Ouest, sauce aux cerises noires, gratin dauphinois.',             price: 36, active: false },
      { id: 'risotto',      name: 'Risotto aux truffes',     desc: 'Carnaroli crémeux, truffe noire du Périgord, parmesan affiné 24 mois.',         price: 44, active: false },
      { id: 'veau',         name: 'Côte de veau aux morilles', desc: 'Veau fermier, sauce aux morilles, gnocchi maison à la sauge.',                price: 39, active: false },
      { id: 'volaille',     name: 'Suprême de volaille',     desc: 'Volaille fermière de Bresse, jus corsé, légumes glacés de saison.',             price: 34, active: false },
      { id: 'bar',          name: 'Bar grillé aux agrumes',  desc: 'Bar de ligne, fenouil rôti, salsa d\'agrumes, huile d\'olive de Maussane.',     price: 40, active: false },
      { id: 'agneau',       name: 'Agneau de Provence',      desc: 'Carré d\'agneau de Sisteron en croûte d\'herbes, ratatouille fine, jus à l\'ail confit.', price: 42, active: false },
    ],
  },
  {
    section: 'Fromages',
    sectionNumber: 'III',
    items: [
      { id: 'fromages',     name: 'Plateau de fromages affinés', desc: 'Sélection du maître affineur : sept fromages fermiers, confitures maison.', price: 18, active: false },
    ],
  },
  {
    section: 'Desserts',
    sectionNumber: 'IV',
    items: [
      // ⭐  LE SEUL PLAT ACTIF — démo fonctionnelle
      { id: 'tarte-fraises', name: 'Tarte aux fraises',      desc: 'Pâte sablée à la vanille, crème pâtissière, fraises de Carpentras, basilic frais.', price: 14, active: true },

      { id: 'souffle',      name: 'Soufflé au Grand Marnier', desc: 'Soufflé minute à l\'orange, sauce chocolat noir Valrhona 70%.',                price: 16, active: false },
      { id: 'creme-brulee', name: 'Crème brûlée',            desc: 'Crème onctueuse à la vanille de Madagascar, croûte de sucre cassonade.',         price: 12, active: false },
      { id: 'moelleux',     name: 'Moelleux au chocolat',    desc: 'Cœur coulant chocolat noir, glace vanille bourbon, éclats de fève de cacao.',    price: 13, active: false },
      { id: 'mille-feuille', name: 'Mille-feuille tradition', desc: 'Feuilletage inversé, crème diplomate à la vanille, glaçage minute.',           price: 14, active: false },
      { id: 'ile-flottante', name: 'Île flottante',          desc: 'Blancs en neige, crème anglaise, pralines roses, caramel à la fleur de sel.',  price: 12, active: false },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────
   🎨  Icônes SVG inline (cadenas, cube 3D)
   ───────────────────────────────────────────────────────────────── */
const ICON_CUBE = `
  <svg class="btn-3d__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
`;

const ICON_LOCK = `
  <svg class="btn-soon__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
  </svg>
`;

/* ─────────────────────────────────────────────────────────────────
   🛠  Helpers
   ───────────────────────────────────────────────────────────────── */
function formatPrice(price) {
  return `${price}<span class="dish__price-suffix"> €</span>`;
}

function renderDish(dish) {
  const isActive = dish.active === true;

  const statusBlock = isActive
    ? `<span class="dish__status dish__status--live">Disponible en 3D</span>`
    : `<span class="dish__status">Visualisation à venir</span>`;

  const buttonBlock = isActive
    ? `<button
         type="button"
         class="btn-3d"
         data-dish="${dish.id}"
         aria-label="Voir la ${dish.name} en 3D"
       >
         ${ICON_CUBE}
         <span>Voir en 3D</span>
       </button>`
    : `<span
         class="btn-soon"
         aria-disabled="true"
         role="button"
         tabindex="-1"
       >
         ${ICON_LOCK}
         <span>Bientôt disponible</span>
       </span>`;

  return `
    <article class="dish ${isActive ? 'dish--active' : ''}" data-id="${dish.id}">
      <div class="dish__head">
        <h3 class="dish__title">${dish.name}</h3>
        <span class="dish__price">${formatPrice(dish.price)}</span>
      </div>
      <p class="dish__desc">${dish.desc}</p>
      <div class="dish__foot">
        ${statusBlock}
        ${buttonBlock}
      </div>
    </article>
  `;
}

function renderSection(section) {
  return `
    <section class="section" aria-labelledby="sec-${section.sectionNumber}">
      <header class="section__header">
        <span class="section__number">${section.sectionNumber}</span>
        <h2 class="section__title" id="sec-${section.sectionNumber}">${section.section}</h2>
        <span class="section__rule" aria-hidden="true"></span>
      </header>
      <div class="dishes">
        ${section.items.map(renderDish).join('')}
      </div>
    </section>
  `;
}

/* ─────────────────────────────────────────────────────────────────
   🚀  Initialisation
   ───────────────────────────────────────────────────────────────── */
function init() {
  const menuEl = document.getElementById('menu');
  if (!menuEl) return;

  menuEl.innerHTML = MENU.map(renderSection).join('');

  // Animation d'apparition échelonnée pour les sections
  const sections = menuEl.querySelectorAll('.section');
  sections.forEach((sec, i) => {
    sec.style.animationDelay = `${100 + i * 120}ms`;
  });

  // Branche le clic sur les boutons 3D actifs
  const activeButtons = document.querySelectorAll('.btn-3d[data-dish]');
  activeButtons.forEach(btn => {
    btn.addEventListener('click', handleView3D);
  });
}

function handleView3D(event) {
  const btn = event.currentTarget;
  const dishId = btn.getAttribute('data-dish');

  // On peut passer le plat en paramètre si le viewer le supporte
  // Si VIEWER_URL contient déjà un "?", on ajoute "&", sinon "?"
  const separator = VIEWER_URL.includes('?') ? '&' : '?';
  const target = `${VIEWER_URL}${separator}dish=${encodeURIComponent(dishId)}`;

  // Petit feedback visuel avant la redirection
  btn.style.transform = 'scale(0.97)';
  setTimeout(() => {
    window.location.href = target;
  }, 120);
}

// Lance l'app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
