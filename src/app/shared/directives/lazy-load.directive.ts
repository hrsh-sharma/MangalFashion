import { Directive, ElementRef, Input, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appLazyLoad]'
})
export class LazyLoadDirective implements OnInit, OnDestroy {
  @Input() src: string = '';
  @Input() alt: string = '';
  @Input() placeholder: string = 'assets/images/placeholder.png';

  private observer: IntersectionObserver | undefined;
  private imgElement: HTMLImageElement;

  constructor(private el: ElementRef) {
    this.imgElement = this.el.nativeElement;
  }

  ngOnInit() {
    // Set initial placeholder image
    if (this.placeholder) {
      this.imgElement.src = this.placeholder;
    }

    // Create intersection observer
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage();
            this.observer?.unobserve(this.imgElement);
          }
        });
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before the image comes into view
        threshold: 0.01
      }
    );

    // Start observing the image element
    this.observer.observe(this.imgElement);
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private loadImage() {
    if (this.src) {
      const img = new Image();

      img.onload = () => {
        // Image loaded successfully, set the real source
        this.imgElement.src = this.src;
        if (this.alt) {
          this.imgElement.alt = this.alt;
        }
        // Add a class to indicate the image has loaded
        this.imgElement.classList.add('lazy-loaded');
      };

      img.onerror = () => {
        // If the image fails to load, keep the placeholder
        console.warn(`Failed to load image: ${this.src}`);
        this.imgElement.classList.add('lazy-load-error');
      };

      // Start loading the image
      img.src = this.src;
    }
  }
}