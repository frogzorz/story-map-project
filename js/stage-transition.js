// fade between stages of presentation
export function createStageTransition(element, update, motion) {
  let animation;
  let revision = 0;
  let initialized = false;
  let latestId;

  async function show(id) {
    latestId = id;
    const current = ++revision;
    animation?.cancel();
    if (!initialized || motion.matches || !element.animate) {
      initialized = true;
      update(id);
      return;
    }
    animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 120, easing: 'ease-out', fill: 'forwards',
    });
    try {
      await animation.finished;
    } catch {
      return; // a newer scroll stage superseded this one
    }
    if (current !== revision) return;
    update(id);
    animation.cancel();
    animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180, easing: 'ease-in',
    });
  }

  motion.addEventListener('change', () => {
    if (motion.matches && initialized) show(latestId);
  });
  return show;
}
