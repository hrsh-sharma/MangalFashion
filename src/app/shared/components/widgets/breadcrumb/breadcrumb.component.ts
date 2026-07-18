import { Component, Input } from '@angular/core';
import { Breadcrumb, Item } from '../../../interface/breadcrumb';

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss']
})
export class BreadcrumbComponent {

  @Input() breadcrumb: Breadcrumb | null;

  get filteredItems(): Item[] {
    if (!this.breadcrumb?.items) {
      return [];
    }
    // Filter out "Home" items since we already have a hardcoded Home link
    return this.breadcrumb.items.filter(item => 
      item?.label?.toLowerCase() !== 'home'
    );
  }

}
