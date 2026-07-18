import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Params } from '../../../../../../shared/interface/core.interface';

@Component({
  selector: 'app-collection-price-filter',
  templateUrl: './collection-price-filter.component.html',
  styleUrls: ['./collection-price-filter.component.scss']
})
export class CollectionPriceFilterComponent implements OnChanges {

  @Input() filter: Params;

  @Input() minRange: number = 0;
  @Input() maxRange: number = 2000;
  public minPrice: number = 599;
  public maxPrice: number = 1799;

  constructor(private route: ActivatedRoute,
    private router: Router) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.filter && this.filter['price']) {
      const priceRange = this.filter['price'].split('-');
      if (priceRange.length === 2) {
        this.minPrice = parseInt(priceRange[0]) || this.minPrice;
        this.maxPrice = parseInt(priceRange[1]) || this.maxPrice;
      }
    }
  }

  onPriceChange() {
    // Ensure min doesn't exceed max and vice versa
    if (this.minPrice > this.maxPrice) {
      this.minPrice = this.maxPrice;
    }
    if (this.maxPrice < this.minPrice) {
      this.maxPrice = this.minPrice;
    }

    // Ensure values are within range
    if (this.minPrice < this.minRange) {
      this.minPrice = this.minRange;
    }
    if (this.maxPrice > this.maxRange) {
      this.maxPrice = this.maxRange;
    }

    this.applyFilter();
  }

  onMinSliderChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value);
    if (value <= this.maxPrice) {
      this.minPrice = value;
    }
  }

  onMaxSliderChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value);
    if (value >= this.minPrice) {
      this.maxPrice = value;
    }
  }

  onSliderChange() {
    // Ensure min doesn't exceed max
    if (this.minPrice > this.maxPrice) {
      this.minPrice = this.maxPrice;
    }
    if (this.maxPrice < this.minPrice) {
      this.maxPrice = this.minPrice;
    }

    this.applyFilter();
  }

  applyFilter() {
    const priceValue = `${this.minPrice}-${this.maxPrice}`;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        price: priceValue,
        page: 1
      },
      queryParamsHandling: 'merge',
      skipLocationChange: false
    });
  }

  getMinPercent(): number {
    return ((this.minPrice - this.minRange) / (this.maxRange - this.minRange)) * 100;
  }

  getRangePercent(): number {
    return ((this.maxPrice - this.minPrice) / (this.maxRange - this.minRange)) * 100;
  }

}
