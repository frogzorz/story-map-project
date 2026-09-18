// adapted from scrollytelly controller
class SlideDeck {
  constructor(slides, onSlideChange) {
    this.slides = slides;
    this.onSlideChange = onSlideChange;
    this.currentSlideIndex = -1;
    this.calcCurrentSlideIndex();
  }

  calcCurrentSlideIndex() {
    const threshold = window.innerHeight * 0.65;
    let nextIndex = 0;
    for (let i = 0; i < this.slides.length; i++) {
      if (this.slides[i].getBoundingClientRect().top <= threshold) nextIndex = i;
    }
    if (nextIndex !== this.currentSlideIndex) {
      this.currentSlideIndex = nextIndex;
      this.onSlideChange(this.slides[nextIndex].id);
    }
  }
}

export { SlideDeck };
