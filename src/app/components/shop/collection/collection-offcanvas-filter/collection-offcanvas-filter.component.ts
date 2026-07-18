import { Component, Input, DoCheck } from '@angular/core';
import { Params } from '../../../../shared/interface/core.interface';
import { AttributeService } from '../../../../shared/services/attribute.service';

@Component({
  selector: 'app-collection-offcanvas-filter',
  templateUrl: './collection-offcanvas-filter.component.html',
  styleUrls: ['./collection-offcanvas-filter.component.scss']
})
export class CollectionOffCanvasFilterComponent implements DoCheck {

  @Input() filter: Params;
  private previousOffCanvasState: boolean = false;

  constructor(public attributeService: AttributeService) {
  }

  ngDoCheck() {
    // Check if offCanvasMenu state has changed
    if (this.attributeService.offCanvasMenu !== this.previousOffCanvasState) {
      this.previousOffCanvasState = this.attributeService.offCanvasMenu;
      this.toggleBodyScroll(!this.attributeService.offCanvasMenu);
    }
  }

  closeCanvasMenu() {
    this.attributeService.offCanvasMenu = false;
  }

  private toggleBodyScroll(enable: boolean) {
    if (enable) {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    } else {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    }
  }

}
