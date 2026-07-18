import { Component, Input, OnInit } from '@angular/core';
import { Params } from '../../../../shared/interface/core.interface';
import { AttributeService } from '../../../../shared/services/attribute.service';
import * as data from  '../../../../shared/data/owl-carousel';

@Component({
  selector: 'app-collection-category-sidebar',
  templateUrl: './collection-category-sidebar.component.html',
  styleUrls: ['./collection-category-sidebar.component.scss']
})
export class CollectionCategorySidebarComponent implements OnInit {

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
