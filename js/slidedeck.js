// adapted from scrollytelly controller
class SlideDeck {
  constructor(slides, map, collection, slideOptions, onSlideChange) {
    this.slides = slides;
    this.map = map;
    this.slideOptions = slideOptions;
    this.onSlideChange = onSlideChange;
    this.currentSlideIndex = -1;
    this.dataLayer = L.geoJSON(collection, slideOptions[slides[0].id]).addTo(map);
    this.bounds = this.dataLayer.getBounds();
    if (!this.bounds.isValid()) throw new Error('The tract layer has no valid bounds.');
    this.fitMap();
    this.calcCurrentSlideIndex();
  }

  fitMap() {
    this.map.invalidateSize();
    this.map.fitBounds(this.bounds, { padding: [16, 16], animate: false });
  }

  syncMapToCurrentSlide() {
    const slide = this.slides[this.currentSlideIndex];
    // geometry stays fixed; only the displayed property and legend change
    this.dataLayer.setStyle(this.slideOptions[slide.id].style);
    this.onSlideChange(slide.id);
  }

  calcCurrentSlideIndex() {
    const threshold = window.innerHeight * 0.65;
    let nextIndex = 0;
    for (let i = 0; i < this.slides.length; i++) {
      if (this.slides[i].getBoundingClientRect().top <= threshold) nextIndex = i;
    }
    if (nextIndex !== this.currentSlideIndex) {
      this.currentSlideIndex = nextIndex;
      this.syncMapToCurrentSlide();
    }
  }
}

export { SlideDeck };
