// adapted from scrollytelly controller
class SlideDeck {
  constructor(slides, onSlideChange) {
    this.slides = slides;
    this.onSlideChange = onSlideChange;
    this.currentSlideIndex = -1;
    this.calcCurrentSlideIndex();
  }

  select(id, source = 'scroll') {
    const nextIndex = Array.from(this.slides).findIndex((slide) => slide.id === id);
    if (nextIndex < 0 || nextIndex === this.currentSlideIndex) return false;
    this.currentSlideIndex = nextIndex;
    this.onSlideChange(id, source);
    return true;
  }

  calcCurrentSlideIndex() {
    const threshold = window.innerHeight * 0.65;
    let nextIndex = 0;
    for (let i = 0; i < this.slides.length; i++) {
      if (this.slides[i].getBoundingClientRect().top <= threshold) nextIndex = i;
    }
    this.select(this.slides[nextIndex].id);
  }
}

export { SlideDeck };
