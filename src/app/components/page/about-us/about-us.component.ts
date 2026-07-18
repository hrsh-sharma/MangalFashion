import { Component } from '@angular/core';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';

@Component({
  selector: 'app-about-us',
  templateUrl: './about-us.component.html',
  styleUrls: ['./about-us.component.scss']
})
export class AboutUsComponent {

  public breadcrumb: Breadcrumb = {
    title: "About Us",
    items: [{ label: 'About Us', active: true }]
  }

  constructor() {}
}
