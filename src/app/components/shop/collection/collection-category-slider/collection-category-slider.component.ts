import { Component, Input, OnInit } from '@angular/core';
import { Params } from '../../../../shared/interface/core.interface';
import * as data from  '../../../../shared/data/owl-carousel';
import { AttributeService } from '../../../../shared/services/attribute.service';

@Component({
  selector: 'app-collection-category-slider',
  templateUrl: './collection-category-slider.component.html',
  styleUrls: ['./collection-category-slider.component.scss']
})
export class CollectionCategorySliderComponent implements OnInit {

  @Input() filter: Params;

  public categorySlider = data.categorySlider;

  constructor(public attributeService: AttributeService) {}

  ngOnInit() {
    // Ensure sidebar is closed by default
    this.attributeService.offCanvasMenu = false;
  }

  closeCanvasMenu() {
    this.attributeService.offCanvasMenu = false;
  }

}
