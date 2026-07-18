import { Component, OnInit } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { CartState } from '../../../state/cart.state';
import { SettingState } from '../../../state/setting.state';
import { Option } from '../../../interface/theme-option.interface';
import { Values } from '../../../interface/setting.interface';
import { Cart } from '../../../interface/cart.interface';
import { ToggleSidebarCart, UpdateCart, DeleteCart, ClearCart } from '../../../action/cart.action';
import { CartService } from '../../../services/cart.service';

@Component({
    selector: 'app-cart-sidebar',
    templateUrl: './cart-sidebar.component.html',
    styleUrls: ['./cart-sidebar.component.scss']
})
export class CartSidebarComponent implements OnInit {

    @Select(CartState.sidebarCartOpen) sidebarCartOpen$: Observable<boolean>;
    @Select(CartState.cartItems) cartItem$: Observable<Cart[]>;
    @Select(CartState.cartTotal) cartTotal$: Observable<number>;
    @Select(SettingState.setting) setting$: Observable<Values>;

    public shippingFreeAmt: number = 0;
    public cartTotal: number = 0;
    public shippingCal: number = 0;
    public remainingShipping: number = 0;

    constructor(private store: Store, public cartService: CartService) { }

    ngOnInit(): void {

        // Calculate Free Shipping Progress
        this.cartTotal$.subscribe(total => {
            this.cartTotal = total;
            this.setting$.subscribe(setting => {
                this.shippingFreeAmt = setting?.general?.min_order_free_shipping || 0;
                if (this.shippingFreeAmt > 0) {
                    this.shippingCal = (this.cartTotal * 100) / this.shippingFreeAmt;
                    if (this.shippingCal > 100) this.shippingCal = 100;
                    this.remainingShipping = this.shippingFreeAmt - this.cartTotal;
                }
            });
        });
    }

    closeCart() {
        this.store.dispatch(new ToggleSidebarCart(false));
    }

    updateQuantity(item: Cart, qty: number) {
        const params = {
            id: item.id,
            product_id: item.product.id,
            product: item.product,
            variation_id: item.variation_id,
            variation: item.variation,
            quantity: qty
        };
        this.store.dispatch(new UpdateCart(params));
    }

    delete(id: number) {
        this.store.dispatch(new DeleteCart(id));
    }
}
