(function () {
  const NOTICE = 'https://www.notice-wonder-repeat.net';

  // One set per calendar day, in this order. ?quirk=animals|rockets|trees|charts previews one.
  const SETS = [
    {
      id: 'animals',
      label: 'Distract me with something quirky!',
      title: 'Animals with Appropriate Accessories',
      hook: 'When I\'m not thinking about CalFresh, I sometimes think about what accessories animals would use to highlight their unique qualities.',
      doodle: 'assets/quirk/doodle-ostrich.png',
      play: NOTICE + '/#animals',
      startId: 'ostrich',
      items: [
        { id: 'snowy-bison-1', title: 'Snowy bison', src: 'assets/quirk/snowy-bison-1.jpg' },
        { id: 'snowy-bison-2', title: 'Snowy bison II', src: 'assets/quirk/snowy-bison-2.jpg' },
        { id: 'beaver-bling', title: 'Beaver w/ Grill', src: 'assets/quirk/beaver-bling.png' },
        { id: 'sunmaxxing-cat', title: 'Sunmaxxing cat', src: 'assets/quirk/sunmaxxing-cat.png' },
        { id: 'giraffe', title: 'Giraffe', src: 'assets/quirk/giraffe.png' },
        { id: 'ostrich', title: 'Ostrich', src: 'assets/quirk/ostrich.png' },
        { id: 'brave-penguin', title: 'Brave penguin', src: 'assets/quirk/brave-penguin.png' },
        { id: 'punk-elephant', title: 'Punk elephant', src: 'assets/quirk/punk-elephant.png' }
      ]
    },
    {
      id: 'rockets',
      label: 'Other ways to paint a rocket',
      title: 'Other ideas for ways to paint rocketships',
      hook: 'When I need to think about something other than CalFresh, I sometimes think about how a re-imagining of the traditional white rocket paint job might make life a little more fun.',
      doodle: 'assets/quirk/doodle-shark.png',
      play: NOTICE + '/#joys',
      startId: 'shark',
      items: [
        { id: 'popsicle', title: 'Popsicle rocket', src: 'assets/quirk/rockets/popsicle.jpg' },
        { id: 'shark', title: 'Shark rocket', src: 'assets/quirk/rockets/shark.jpg' },
        { id: 'gnome', title: 'Gnome rocket', src: 'assets/quirk/rockets/gnome.jpg' }
      ]
    },
    {
      id: 'trees',
      label: 'Distract me with trees and flowers',
      title: 'Trees & Flowers',
      hook: 'If you need a little pick-me-up, I highly recommend becoming momentarily obsessed with the striking beauty of a tree or flower.',
      doodle: 'assets/quirk/doodle-fuchsia.png',
      cornerHeight: '110',
      play: NOTICE + '/#trees',
      startId: 'fuchsia',
      items: [
        { id: 'oak', title: 'Oak', src: 'assets/quirk/trees/oak.jpg' },
        { id: 'bark', title: 'Bark detail', src: 'assets/quirk/trees/bark.jpg' },
        { id: 'leaf-wiggle', title: 'Leaf wiggle', src: 'assets/quirk/trees/leaf-wiggle.jpg' },
        { id: 'new-growth', title: 'New growth', src: 'assets/quirk/trees/new-growth.jpg' },
        { id: 'wisteria', title: 'Wisteria', src: 'assets/quirk/trees/wisteria.jpg' },
        { id: 'magnolia', title: 'Magnolia blossoms', src: 'assets/quirk/trees/magnolia.jpg' },
        { id: 'cypress', title: 'Monterey cypress grove', src: 'assets/quirk/trees/cypress.jpg' },
        { id: 'palm', title: 'Palm tree', src: 'assets/quirk/trees/palm.jpg' },
        { id: 'fuchsia', title: 'Fuchsia', src: 'assets/quirk/trees/fuchsia.jpg' },
        { id: 'sketch', title: 'Tree sketch', src: 'assets/quirk/trees/sketch.png' }
      ]
    },
    {
      id: 'charts',
      label: 'Charts about other things',
      title: 'Charts about other things I\'ve noticed',
      hook: 'When I\'m not making charts about CalFresh, I make charts about other things I\'ve noticed.',
      doodle: 'assets/quirk/doodle-dentistry.png',
      startId: 'dentistry',
      items: [
        { id: 'parabola', title: 'Another parabola observed in nature', src: 'assets/quirk/charts/parabola.png' },
        { id: 'binoculars', title: 'Binoculars', src: 'assets/quirk/charts/binoculars.png' },
        { id: 'boogies', title: 'Types of boogies', src: 'assets/quirk/charts/boogies.png' },
        { id: 'standardization', title: 'Standardization and how it makes me feel', src: 'assets/quirk/charts/standardization.png' },
        { id: 'sweet-caroline', title: 'Sweet Caroline', src: 'assets/quirk/charts/sweet-caroline.png' },
        { id: 'dentistry', title: 'Modern dentistry', src: 'assets/quirk/charts/dentistry.png' }
      ]
    }
  ];

  function pickSet() {
    const want = new URLSearchParams(window.location.search).get('quirk');
    const found = want && SETS.find(item => item.id === want);
    if (found) return found;
    const now = new Date();
    const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    return SETS[((day % SETS.length) + SETS.length) % SETS.length];
  }

  const set = pickSet();
  const QUIRK_LABEL = set.label;
  const ITEMS = set.items;
  const START_INDEX = Math.max(0, ITEMS.findIndex(item => item.id === set.startId));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(key => {
        const val = attrs[key];
        if (val == null || val === false) return;
        if (key === 'text') { node.textContent = val; return; }
        if (key === 'className') { node.className = val; return; }
        node.setAttribute(key, val === true ? '' : val);
      });
    }
    (children || []).forEach(child => { if (child) node.appendChild(child); });
    return node;
  }

  const header = document.querySelector('header.page-head');
  const brand = header && header.querySelector('a.brand');
  if (!header || !brand) return;

  let row = header.querySelector('.quirk-brand-row');
  if (!row) {
    row = el('div', { className: 'quirk-brand-row' });
    brand.replaceWith(row);
    row.appendChild(brand);
  }
  const title = header.querySelector('.site-title');
  if (title && title.parentElement !== row) row.appendChild(title);

  const cornerHeight = set.cornerHeight || '140';
  const doodle = el('button', {
    className: 'quirk-doodle' + (set.cornerHeight ? ' quirk-doodle--compact' : ''),
    type: 'button',
    'aria-expanded': 'false',
    'aria-haspopup': 'dialog',
    'aria-controls': 'quirkDialog',
    'aria-label': QUIRK_LABEL
  }, [
    el('img', { src: set.doodle, alt: '', height: cornerHeight }),
    el('span', { className: 'quirk-doodle-tip', text: QUIRK_LABEL })
  ]);
  row.appendChild(doodle);

  const TITLE_GAP = 12;
  let inlineTitleW = 0;
  function layoutSiteTitle() {
    if (!title) return;
    const stacked = row.classList.contains('quirk-brand-row--stacked');
    if (!stacked) inlineTitleW = title.offsetWidth;
    const rowR = row.getBoundingClientRect();
    const brandR = brand.getBoundingClientRect();
    const img = doodle.querySelector('img');
    const sideR = (img || doodle).getBoundingClientRect();
    const titleW = inlineTitleW || title.offsetWidth;
    const mid = rowR.left + rowR.width / 2;
    const cramped = (mid - titleW / 2) < (brandR.right + TITLE_GAP)
      || (mid + titleW / 2) > (sideR.left - TITLE_GAP);
    row.classList.toggle('quirk-brand-row--stacked', cramped);
  }
  let titleLayoutTick = 0;
  function scheduleTitleLayout() {
    if (titleLayoutTick) return;
    titleLayoutTick = requestAnimationFrame(() => {
      titleLayoutTick = 0;
      layoutSiteTitle();
    });
  }
  layoutSiteTitle();
  const doodleImg = doodle.querySelector('img');
  if (doodleImg) {
    if (doodleImg.complete) scheduleTitleLayout();
    else doodleImg.addEventListener('load', scheduleTitleLayout);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      row.classList.remove('quirk-brand-row--stacked');
      inlineTitleW = 0;
      layoutSiteTitle();
    });
  }
  window.addEventListener('resize', scheduleTitleLayout);
  if (window.ResizeObserver) new ResizeObserver(scheduleTitleLayout).observe(row);

  const titleEl = el('h2', { className: 'quirk-title', id: 'quirkTitle', text: set.title });
  const hookEl = el('p', { className: 'quirk-hook', text: set.hook });
  const imgEl = el('img', { alt: '' });
  const figure = el('figure', { className: 'quirk-figure' }, [imgEl]);
  const prevBtn = el('button', {
    className: 'quirk-nav',
    type: 'button',
    'aria-label': 'Previous picture',
    text: '←'
  });
  const nextBtn = el('button', {
    className: 'quirk-nav',
    type: 'button',
    'aria-label': 'Next picture',
    text: '→'
  });
  const countEl = el('span', { className: 'quirk-count' });
  const nav = el('div', { className: 'quirk-nav-row' }, [
    prevBtn,
    countEl,
    nextBtn
  ]);
  const playEl = el('a', {
    className: 'quirk-play',
    href: set.play || NOTICE,
    target: '_blank',
    rel: 'noopener noreferrer',
    text: 'Play along at Notice'
  });
  const closeBtn = el('button', { className: 'quirk-close', type: 'button', 'aria-label': 'Close', text: '×' });
  const creditLink = el('a', {
    href: NOTICE,
    target: '_blank',
    rel: 'noopener noreferrer',
    text: 'Notice. Wonder. Repeat.'
  });
  const credit = el('p', { className: 'quirk-credit' }, [
    el('span', { className: 'quirk-credit-line', text: 'This has been a tiny break from the serious stuff, courtesy of' }),
    el('span', { className: 'quirk-credit-line' }, [
      creditLink,
      document.createTextNode(' Diana’s totally unrelated quirky side project.')
    ])
  ]);
  const panel = el('div', { className: 'quirk-panel', role: 'document' }, [
    el('div', { className: 'quirk-panel-head' }, [titleEl, closeBtn]),
    hookEl,
    figure,
    nav,
    playEl,
    credit
  ]);
  const backdrop = el('div', { className: 'quirk-backdrop' });
  const dialog = el('div', {
    className: 'quirk-dialog',
    id: 'quirkDialog',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'quirkTitle',
    hidden: true
  }, [backdrop, panel]);
  document.body.appendChild(dialog);

  let index = START_INDEX >= 0 ? START_INDEX : 0;
  let lastFocus = null;

  function render() {
    const item = ITEMS[index];
    imgEl.src = item.src;
    imgEl.alt = item.title;
    countEl.textContent = (index + 1) + ' of ' + ITEMS.length;
  }

  function step(delta) {
    index = (index + delta + ITEMS.length) % ITEMS.length;
    render();
  }

  function focusables() {
    return Array.from(panel.querySelectorAll('a[href], button:not([disabled])'))
      .filter(node => !node.hidden && !node.closest('[hidden]'));
  }

  function open() {
    lastFocus = document.activeElement;
    index = START_INDEX >= 0 ? START_INDEX : 0;
    render();
    dialog.hidden = false;
    document.body.classList.add('quirk-open');
    doodle.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  }

  function close() {
    dialog.hidden = true;
    document.body.classList.remove('quirk-open');
    doodle.setAttribute('aria-expanded', 'false');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  doodle.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  document.addEventListener('keydown', e => {
    if (dialog.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
      return;
    }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();

(function () {
  document.querySelectorAll('.copy-email').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.getAttribute('data-email');
      if (!email) return;
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = email;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const status = btn.parentElement && btn.parentElement.querySelector('.copy-email-status');
      if (!status) return;
      status.textContent = 'Copied';
      clearTimeout(btn._copyTimer);
      btn._copyTimer = setTimeout(() => { status.textContent = ''; }, 1600);
    });
  });
})();
