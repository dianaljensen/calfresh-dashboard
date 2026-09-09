(function () {
  const NOTICE = 'https://www.notice-wonder-repeat.net';
  const QUIRK_LABEL = 'Distract me with something quirky!';
  const SERIES_TITLE = 'Animals with Appropriate Accessories';
  const SERIES_HOOK = 'When I\'m not thinking about CalFresh, I sometimes think about what accessories animals would use to highlight their unique qualities.';

  const ITEMS = [
    { id: 'snowy-bison-1', title: 'Snowy bison', src: 'assets/quirk/snowy-bison-1.jpg' },
    { id: 'snowy-bison-2', title: 'Snowy bison II', src: 'assets/quirk/snowy-bison-2.jpg' },
    { id: 'beaver-bling', title: 'Beaver w/ Grill', src: 'assets/quirk/beaver-bling.png' },
    { id: 'sunmaxxing-cat', title: 'Sunmaxxing cat', src: 'assets/quirk/sunmaxxing-cat.png' },
    { id: 'giraffe', title: 'Giraffe', src: 'assets/quirk/giraffe.png' },
    { id: 'ostrich', title: 'Ostrich', src: 'assets/quirk/ostrich.png' },
    { id: 'brave-penguin', title: 'Brave penguin', src: 'assets/quirk/brave-penguin.png' },
    { id: 'punk-elephant', title: 'Punk elephant', src: 'assets/quirk/punk-elephant.png' }
  ];
  const START_INDEX = ITEMS.findIndex(item => item.id === 'ostrich');

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

  const doodle = el('button', {
    className: 'quirk-doodle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-haspopup': 'dialog',
    'aria-controls': 'quirkDialog',
    'aria-label': QUIRK_LABEL
  }, [
    el('img', { src: 'assets/quirk/doodle-ostrich.png', alt: '', height: '80' }),
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
    const doodleR = doodle.getBoundingClientRect();
    const titleW = inlineTitleW || title.offsetWidth;
    const mid = rowR.left + rowR.width / 2;
    const cramped = (mid - titleW / 2) < (brandR.right + TITLE_GAP)
      || (mid + titleW / 2) > (doodleR.left - TITLE_GAP);
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
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      row.classList.remove('quirk-brand-row--stacked');
      inlineTitleW = 0;
      layoutSiteTitle();
    });
  }
  window.addEventListener('resize', scheduleTitleLayout);
  if (window.ResizeObserver) new ResizeObserver(scheduleTitleLayout).observe(row);

  const titleEl = el('h2', { className: 'quirk-title', id: 'quirkTitle', text: SERIES_TITLE });
  const hookEl = el('p', { className: 'quirk-hook', text: SERIES_HOOK });
  const imgEl = el('img', { alt: '' });
  const figure = el('figure', { className: 'quirk-figure' }, [imgEl]);
  const prevBtn = el('button', {
    className: 'quirk-nav',
    type: 'button',
    'aria-label': 'Previous animal',
    text: '←'
  });
  const nextBtn = el('button', {
    className: 'quirk-nav',
    type: 'button',
    'aria-label': 'Next animal',
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
    href: NOTICE,
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
