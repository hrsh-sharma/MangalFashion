import { Component, Input, ViewChild } from '@angular/core';
import { Product } from '../../../../../interface/product.interface';
import { Cart, CartAddOrUpdate } from '../../../../../interface/cart.interface';
import { AddToCart } from '../../../../../action/cart.action';
import { Select, Store } from '@ngxs/store';
import { CartState } from '../../../../../state/cart.state';
import { Observable } from 'rxjs';
import { ProductDetailModalComponent } from '../../../modal/product-detail-modal/product-detail-modal.component';
import { CartPopupModalComponent } from '../../../modal/cart-popup-modal/cart-popup-modal.component';

@Component({
  selector: 'app-product-cart-button',
  templateUrl: './product-cart-button.component.html',
  styleUrl: './product-cart-button.component.scss'
})
export class ProductCartButtonComponent {

  @Input() product: Product;
  @Input() text: string;
  @Input() iconClass: string;

  @Select(CartState.cartItems) cartItem$: Observable<Cart[]>;

  @ViewChild("productDetailModal") productDetailModal: ProductDetailModalComponent;
  @ViewChild("cartPopupModal") cartPopupModal: CartPopupModalComponent;

  public cartItem: Cart | null;
  public currentDate: number | null;
  public saleStartDate: number | null;

  constructor(private store: Store) {
  }

  ngOnInit() {
    this.cartItem$.subscribe(items => {
      this.cartItem = items.find(item => item.product.id == this.product.id)!;
    });
  }

  addToCart(product: Product, qty: number) {
    if (this.cartPopupModal) {
      this.cartPopupModal.openModal(product);
    }
  }

  externalProductLink(link: string) {
    if (link) {
      window.open(link, "_blank");
    }
  }

}
