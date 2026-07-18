import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductResolver } from '../../shared/resolvers/product.resolver';
import { BrandResolver } from '../../shared/resolvers/brand.resolver';

import { AuthGuard } from "./../../core/guard/auth.guard";
import { CheckoutGuard } from "./../../core/guard/checkout.guard";
import { PaymentSuccessGuard } from "./../../core/guard/payment-success.guard";

import { CartComponent } from './cart/cart.component';
import { WishlistComponent } from './wishlist/wishlist.component';
import { CompareComponent } from './compare/compare.component';

// Product
import { ProductComponent } from './product/product.component';

// Collection
import { CollectionComponent } from './collection/collection.component';

// Checkout
import { CheckoutComponent } from './checkout/checkout.component';
import { OrderTrackingComponent } from './order-tracking/order-tracking.component';
import { OrderDetailsComponent } from './order-details/order-details.component';
import { BrandComponent } from './brand/brand.component';
import { CategoryComponent } from './category/category.component';
import { CategoryResolver } from '../../shared/resolvers/category.resolver';
import { CheckoutSuccessComponent } from './checkout/checkout-success/checkout-success.component';
import { PaymentSuccessComponent } from './payment-success/payment-success.component';

const routes: Routes = [
  {
    path: 'success',
    component: PaymentSuccessComponent,
    canActivate: [PaymentSuccessGuard]
  },
  {
    path: 'paymentresult/awaitingconfirmation_cash',
    component: PaymentSuccessComponent,
  },
  {
    path: 'cart',
    component: CartComponent
  },
  {
    path: 'wishlist',
    component: WishlistComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'compare',
    component: CompareComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'product/:slug',
    component: ProductComponent,
    resolve: {
      data: ProductResolver
    }
  },
  {
    path: 'collections',
    component: CollectionComponent
  },
  {
    path: 'collections/:category',
    component: CollectionComponent
  },
  { path: 'seller/become-seller', redirectTo: '/', pathMatch: 'full' },
  { path: 'seller/stores',        redirectTo: '/', pathMatch: 'full' },
  { path: 'seller/store/:slug',   redirectTo: '/', pathMatch: 'full' },
  {
    path: 'checkout',
    component: CheckoutComponent,
    canActivate: [CheckoutGuard]
  },
  {
    path: 'order/tracking',
    component: OrderTrackingComponent
  },
  {
    path: 'order/details',
    component: OrderDetailsComponent
  },
  {
    path: 'brand/:slug',
    component: BrandComponent,
    resolve: {
      data: BrandResolver
    }
  },
  {
    path: 'category/:slug',
    component: CategoryComponent,
    resolve: {
      data: CategoryResolver
    }
  },
  {
    path: 'order/checkout-success',
    component: CheckoutSuccessComponent,
    canActivate: [CheckoutGuard]
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ShopRoutingModule { }
