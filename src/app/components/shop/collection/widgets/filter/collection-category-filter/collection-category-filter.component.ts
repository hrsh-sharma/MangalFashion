import { Component, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { Params } from '../../../../../../shared/interface/core.interface';
import { Category, CategoryModel } from '../../../../../../shared/interface/category.interface';
import { CategoryState } from '../../../../../../shared/state/category.state';

@Component({
  selector: 'app-collection-category-filter',
  templateUrl: './collection-category-filter.component.html',
  styleUrls: ['./collection-category-filter.component.scss']
})
export class CollectionCategoryFilterComponent {

  @Select(CategoryState.category) category$: Observable<CategoryModel>;

  @Input() filter: Params;

  public categories: Category[];
  public selectedCategories: string[] = [];
  public searchText: string = '';
  
  constructor(private route: ActivatedRoute,
    private router: Router){
    this.category$.subscribe(res => this.categories = res.data.filter(category => category.type == 'product'));
  }

  ngOnChanges() {
    this.selectedCategories = this.filter['category'] ? this.filter['category'].split(',') : [];
  }

  toggleCategory(slug: string, category?: Category) {
    // Prevent toggling if category is not clickable
    if (category && category.is_clickable === false) {
      return;
    }

    const index = this.selectedCategories.indexOf(slug);

    if (index === -1) {
      // Add category if not selected
      this.selectedCategories.push(slug);
    } else {
      // Remove category if already selected
      this.selectedCategories.splice(index, 1);
    }

    const categoryPath = this.selectedCategories.length ? this.selectedCategories.join(',') : null;
    this.router.navigate([categoryPath ? `/collections/${categoryPath}` : '/collections']);
  }

  applyFilter(event: Event) {
    const index = this.selectedCategories.indexOf((<HTMLInputElement>event?.target)?.value);  // checked and unchecked value

    if ((<HTMLInputElement>event?.target)?.checked)
      this.selectedCategories.push((<HTMLInputElement>event?.target)?.value); // push in array cheked value
    else
      this.selectedCategories.splice(index,1);  // removed in array unchecked value

    const categoryPath = this.selectedCategories.length ? this.selectedCategories.join(',') : null;
    this.router.navigate([categoryPath ? `/collections/${categoryPath}` : '/collections']);
  }

  // check if the item are selected
  checked(item: string){
    if(this.selectedCategories?.indexOf(item) != -1){
      return true;
    }
    return false;
  }

}
