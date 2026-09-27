import { SlideDeck } from './slidedeck.js';

export function compactInitially(width, height) {
  return width <= 320 || height <= 500;
}

export function createStoryControls(slides, onStage) {
  const shell = document.querySelector('.map-container');
  const content = document.querySelector('#visual-content');
  const toggle = document.querySelector('#visual-toggle');
  const stageStatus = document.querySelector('#stage-status');
  const links = document.querySelectorAll('.chapter-nav a');
  let explicitNavigation = false;
  let movingFocus = false;
  const state = {
    collapsed: compactInitially(window.innerWidth, window.innerHeight),
    currentId: 'citywide', onReveal: () => {}, focusHeading,
  };

  function updateOffset() {
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    const height = narrow ? shell.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--visual-offset', `${height + 12}px`);
  }

  function keepFocusVisible() {
    const element = document.activeElement;
    if (!element?.closest('.slide')) return;
    const rect = element.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const covered = window.innerWidth <= 900 && shellRect.top <= 0;
    const top = covered ? shellRect.bottom + 12 : 12;
    if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: 'instant' });
    else if (rect.bottom > window.innerHeight && rect.height < window.innerHeight - top) {
      window.scrollBy({ top: rect.bottom - window.innerHeight + 12, behavior: 'instant' });
    }
  }

  function focusHeading(id) {
    const heading = document.querySelector(`#${id} h2`);
    heading.tabIndex = -1;
    movingFocus = true;
    heading.focus({ preventScroll: true });
    movingFocus = false;
    requestAnimationFrame(keepFocusVisible);
  }

  function setCollapsed() {
    if (state.collapsed && content.contains(document.activeElement)) toggle.focus();
    content.hidden = state.collapsed;
    shell.classList.toggle('is-collapsed', state.collapsed);
    document.body.classList.toggle('visual-collapsed', state.collapsed);
    toggle.hidden = false;
    toggle.setAttribute('aria-expanded', String(!state.collapsed));
    toggle.textContent = state.collapsed ? 'Show visualization' : 'Hide visualization';
    updateOffset();
  }
  setCollapsed();
  const deck = new SlideDeck(slides, (id, source) => {
    state.currentId = id;
    shell.dataset.stage = id;
    for (const link of links) {
      if (link.hash === `#${id}`) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    }
    onStage(id, source !== 'scroll');
  });

  function navigate(hash, focus = true) {
    const id = hash.slice(1);
    const isTable = id === 'tract-data';
    const slideId = isTable ? 'transitions' : id;
    if (!Array.from(slides).some((slide) => slide.id === slideId)) return;
    explicitNavigation = true;
    deck.select(slideId, 'navigation');
    let target = document.getElementById(slideId);
    if (isTable) {
      document.querySelector('#tract-table-section').open = true;
      target = document.querySelector('#tract-data');
    }
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (focus) {
      if (isTable) target.focus({ preventScroll: true });
      else focusHeading(slideId);
    }
    // headings already announce chapters; only the table shortcut needs extra context
    stageStatus.textContent = isTable ? 'Tract data table opened. Counts, rates, population and cautions are available.' : '';
    requestAnimationFrame(keepFocusVisible);
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!['#tract-data', ...Array.from(slides, (slide) => `#${slide.id}`)].includes(link.hash)) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    navigate(link.hash);
  });
  window.addEventListener('hashchange', () => navigate(location.hash));
  window.addEventListener('popstate', () => navigate(location.hash || '#citywide'));
  document.querySelector('.slide-section').addEventListener('focusin', (event) => {
    if (movingFocus) return;
    const slide = event.target.closest('.slide');
    if (!slide) return;
    explicitNavigation = true;
    deck.select(slide.id, 'focus');
    requestAnimationFrame(keepFocusVisible);
  });
  // explicit navigation owns the stage until the reader resumes page scrolling
  const release = () => { explicitNavigation = false; };
  document.addEventListener('wheel', release, { passive: true });
  document.addEventListener('touchmove', release, { passive: true });
  document.addEventListener('pointerdown', release);
  document.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)
      && !event.target.closest('.table-scroll, summary, button, #map')) release();
  });
  document.addEventListener('scroll', () => {
    if (!explicitNavigation) deck.calcCurrentSlideIndex();
  }, { passive: true });
  toggle.addEventListener('click', () => {
    explicitNavigation = true;
    state.collapsed = !state.collapsed;
    setCollapsed();
    if (!state.collapsed) state.onReveal();
    toggle.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => {
    updateOffset();
    requestAnimationFrame(keepFocusVisible);
  });
  new ResizeObserver(updateOffset).observe(shell);
  if (location.hash) navigate(location.hash);
  return state;
}
