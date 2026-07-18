import { Injectable } from "@angular/core";
import { Action, Selector, State, StateContext, Store } from "@ngxs/store";
import { of, tap } from "rxjs";
import {
  GetCartItems, AddToCartLocalStorage, AddToCart, UpdateCart, DeleteCart,
  CloseStickyCart, ToggleSidebarCart, ClearCart, ReplaceCart, SyncCart
} from "../action/cart.action";
import { Cart, CartModel } from "../interface/cart.interface";
import { CartService } from "../services/cart.service";
import { NotificationService } from "../services/notification.service";

export interface CartStateModel {
  items: Cart[];
  total: number;
  is_digital_only: boolean | number | null;
  stickyCartOpen: boolean;
  sidebarCartOpen: boolean;
}

@State<CartStateModel>({
  name: "cart",
  defaults: {
    items: [],
    total: 0,
    is_digital_only: null,
    stickyCartOpen: false,
    sidebarCartOpen: false
  },
})
@Injectable()
export class CartState {

  constructor(private cartService: CartService,
    private notificationService: NotificationService,
    private store: Store) {
  }

  ngxsOnInit(ctx: StateContext<CartStateModel>) {
    ctx.dispatch(new ToggleSidebarCart(false));
    ctx.dispatch(new CloseStickyCart());
  }

  @Selector()
  static cartItems(state: CartStateModel) {
    return state.items;
  }

  @Selector()
  static cartTotal(state: CartStateModel) {
    return state.total;
  }

  @Selector()
  static cartHasDigital(state: CartStateModel) {
    return state.is_digital_only;
  }

  @Selector()
  static stickyCart(state: CartStateModel) {
    return state.stickyCartOpen;
  }

  @Selector()
  static sidebarCartOpen(state: CartStateModel) {
    return state.sidebarCartOpen;
  }

  @Action(GetCartItems)
  getCartItems(ctx: StateContext<CartStateModel>) {
    if (!this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      return;
    }
    return this.cartService.getCartItems().pipe(
      tap({
        next: result => {
          // Set Selected Variant - Ensure selected_variation is populated for display
          result.items.filter((item: Cart) => {
            if (item?.variation) {
              // Use existing selected_variation if available, otherwise construct from attribute_values
              if (!item.variation.selected_variation || item.variation.selected_variation.trim() === '') {
                const rawValues = item?.variation?.attribute_values?.map(values => values?.value);
                const filteredValues = rawValues?.filter(value => value);
                let constructedVariation = filteredValues?.join('/') || '';

                // If no values found, use variation name as fallback
                if (!constructedVariation && item.variation.name) {
                  constructedVariation = item.variation.name;
                }

                item.variation.selected_variation = constructedVariation;
              }
            }
          });
          ctx.patchState(result);
        },
        error: err => {
          throw new Error(err?.error?.message);
        }
      })
    );
  }

  @Action(AddToCart)
  add(ctx: StateContext<CartStateModel>, action: AddToCart) {
    if (action.payload.id) {
      return this.store.dispatch(new UpdateCart(action.payload));
    }

    if (!this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      return this.store.dispatch(new AddToCartLocalStorage(action.payload));
    }

    return this.cartService.addToCart(action.payload).pipe(
      tap({
        next: result => {
          if (result.items.length) {
            const state = ctx.getState();
            const cart = [...state.items];
            const index = cart.findIndex(item => item.id === result.items[0].id);

            let output = { ...state };

            if (index == -1) {
              output.items = [...state.items, ...result.items];
            } else {
              if (cart[index].product?.wholesales?.length) {
                let wholesale = cart[index].product.wholesales.find(value => value.min_qty <= cart[index].quantity && value.max_qty >= cart[index].quantity) || null;
                if (wholesale && cart[index].product.wholesale_price_type == 'fixed') {
                  cart[index].sub_total = cart[index].quantity * wholesale.value;
                  cart[index].wholesale_price = cart[index].sub_total / cart[index].quantity;
                } else if (wholesale && cart[index].product.wholesale_price_type == 'percentage') {
                  cart[index].sub_total = cart[index].quantity * (cart[index]?.variation ? cart[index]?.variation?.sale_price : cart[index].product.sale_price);
                  cart[index].sub_total = cart[index].sub_total - (cart[index].sub_total * (wholesale.value / 100));
                  cart[index].wholesale_price = cart[index].sub_total / cart[index].quantity;
                } else {
                  cart[index].sub_total = cart[index]?.quantity * (cart[index]?.variation ? cart[index]?.variation?.sale_price : cart[index].product.sale_price);
                  cart[index].wholesale_price = null;
                }
              } else {
                cart[index].sub_total = cart[index]?.quantity * (cart[index]?.variation ? cart[index]?.variation?.sale_price : cart[index].product.sale_price);
                cart[index].wholesale_price = null;
              }
            }

            // Set Selected Variant
            output.items.filter(item => {
              if (item?.variation) {
                // Use existing selected_variation if available, otherwise construct from attribute_values
                if (!item.variation.selected_variation || item.variation.selected_variation.trim() === '') {
                  item.variation.selected_variation = item?.variation?.attribute_values?.map(values => values?.value)?.filter(value => value)?.join('/') || '';
                }
              }
            });

            // Calculate Total
            output.total = output.items.reduce((prev, curr: Cart) => {
              return (prev + Number(curr.sub_total));
            }, 0);

            output.stickyCartOpen = true;
            output.sidebarCartOpen = true;
            output.is_digital_only = result.is_digital_only;
            ctx.patchState(output);

            setTimeout(() => {
              this.store.dispatch(new CloseStickyCart());
            }, 1500);
          }
        },
        error: err => {
          throw new Error(err?.error?.message);
        }
      })
    );
  }

  @Action(AddToCartLocalStorage)
  addToLocalStorage(ctx: StateContext<CartStateModel>, action: AddToCartLocalStorage) {
    const state = ctx.getState();
    const items = [...state.items];
    const salePrice = action.payload.variation ? action.payload.variation.sale_price : action.payload.product?.sale_price;

    let existingItemIndex = -1;
    if (action.payload.variation_id) {
      existingItemIndex = items.findIndex(item => item.variation_id == action.payload.variation_id);
    } else {
      existingItemIndex = items.findIndex(item => item.product_id == action.payload.product_id && !item.variation_id);
    }

    if (existingItemIndex > -1) {
      const existingItem = items[existingItemIndex];
      const productQty = existingItem?.variation ? existingItem?.variation?.quantity : existingItem?.product?.quantity;

      if (productQty < existingItem.quantity + action.payload.quantity) {
        this.notificationService.showError(`You can not add more items than available. In stock ${productQty} items.`);
        return false;
      }

      items[existingItemIndex] = {
        ...existingItem,
        quantity: existingItem.quantity + action.payload.quantity,
        sub_total: (existingItem.quantity + action.payload.quantity) * (existingItem.variation ? existingItem.variation.sale_price : existingItem.product.sale_price)
      };
    } else {
      const newItem: Cart = {
        id: Number(Math.floor(Math.random() * 10000).toString().padStart(4, '0')),
        quantity: action.payload.quantity,
        product: action.payload.product!,
        product_id: action.payload.product_id,
        wholesale_price: null,
        variation: action.payload.variation!,
        variation_id: action.payload.variation_id,
        sub_total: action.payload.quantity * (action.payload.variation ? action.payload.variation.sale_price : (action.payload.product?.sale_price || 0))
      };
      items.push(newItem);
    }

    const finalItems = items.map(item => {
      if (item.variation) {
        // Use existing selected_variation if available, otherwise construct from attribute_values
        const selectedVariation = item.variation.selected_variation && item.variation.selected_variation.trim() !== ''
          ? item.variation.selected_variation
          : item.variation.attribute_values?.map(values => values?.value)?.filter(value => value)?.join('/') || '';

        return {
          ...item,
          variation: {
            ...item.variation,
            selected_variation: selectedVariation
          }
        };
      }
      return item;
    });

    const total = finalItems.reduce((prev, curr) => prev + Number(curr.sub_total), 0);

    ctx.patchState({
      items: finalItems,
      total: total,
      is_digital_only: finalItems.map(item => item.product?.product_type).every(type => type == 'digital'),
      stickyCartOpen: true,
      sidebarCartOpen: true
    });

    setTimeout(() => {
      this.store.dispatch(new CloseStickyCart());
    }, 1500);
  }

  @Action(UpdateCart)
  update(ctx: StateContext<CartStateModel>, action: UpdateCart) {
    const state = ctx.getState();
    const items = [...state.items];
    const index = items.findIndex(item => Number(item.id) === Number(action.payload.id));

    if (index === -1) return;

    const currentItem = items[index];

    if (currentItem?.variation && action.payload.variation_id &&
      Number(currentItem.id) === Number(action.payload.id) &&
      Number(currentItem?.variation_id) != Number(action.payload.variation_id)) {
      return this.store.dispatch(new ReplaceCart(action.payload));
    }

    const productQty = currentItem?.variation ? currentItem?.variation?.quantity : currentItem?.product?.quantity;
    const newQuantity = currentItem.quantity + action.payload.quantity;

    if (productQty < newQuantity) {
      this.notificationService.showError(`You can not add more items than available. In stock ${productQty} items.`);
      return false;
    }

    if (newQuantity < 1) {
      this.store.dispatch(new DeleteCart(action.payload.id!));
      return of();
    }

    // IMMUTABLE UPDATE
    const updatedItem = {
      ...currentItem,
      quantity: newQuantity,
      sub_total: newQuantity * (currentItem?.variation ? currentItem?.variation?.sale_price : currentItem.product.sale_price)
    };

    if (updatedItem.product?.wholesales?.length) {
      let wholesale = updatedItem.product.wholesales.find(value => value.min_qty <= newQuantity && value.max_qty >= newQuantity) || null;
      if (wholesale && updatedItem.product.wholesale_price_type == 'fixed') {
        updatedItem.sub_total = newQuantity * wholesale.value;
        updatedItem.wholesale_price = updatedItem.sub_total / newQuantity;
      } else if (wholesale && updatedItem.product.wholesale_price_type == 'percentage') {
        let basePrice = updatedItem.variation ? updatedItem.variation.sale_price : updatedItem.product.sale_price;
        updatedItem.sub_total = (newQuantity * basePrice) - ((newQuantity * basePrice) * (wholesale.value / 100));
        updatedItem.wholesale_price = updatedItem.sub_total / newQuantity;
      } else {
        updatedItem.wholesale_price = null;
      }
    } else {
      updatedItem.wholesale_price = null;
    }

    const updatedItems = [...items];
    updatedItems[index] = updatedItem;

    const total = updatedItems.reduce((prev, curr: Cart) => prev + Number(curr.sub_total), 0);

    ctx.patchState({
      ...state,
      items: updatedItems,
      is_digital_only: updatedItems.map(item => item.product && item?.product?.product_type).every(item => item == 'digital'),
      total: total
    });

    if (!this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      return;
    }
    return this.cartService.updateCart(action.payload).pipe(
      tap({
        next: result => {
          // Sync with server response
          if (result && result.items) {
            const currentState = ctx.getState();
            ctx.patchState({
              ...currentState,
              items: result.items,
              total: result.total || currentState.total,
              is_digital_only: result.items.map(item => item.product?.product_type).every(type => type == 'digital')
            });
          }
        },
        error: err => {
          throw new Error(err?.error?.message);
        }
      })
    );
  }

  @Action(ReplaceCart)
  replace(ctx: StateContext<CartStateModel>, action: ReplaceCart) {
    const state = ctx.getState();
    const items = [...state.items];
    const index = items.findIndex(item => Number(item.id) === Number(action.payload.id));

    if (index === -1) return;

    let currentItem = { ...items[index] };

    // Update Cart If cart id same but variant id is different
    if (currentItem.variation && action.payload.variation_id &&
      Number(currentItem.id) === Number(action.payload.id) &&
      Number(currentItem?.variation_id) != Number(action.payload.variation_id)) {

      // Use existing selected_variation if available, otherwise construct from attribute_values
      const selectedVariation = action.payload.variation!.selected_variation && action.payload.variation!.selected_variation.trim() !== ''
        ? action.payload.variation!.selected_variation
        : action.payload.variation!.attribute_values?.map(values => values?.value)?.filter(value => value)?.join('/') || '';

      const newVariation = {
        ...action.payload.variation!,
        selected_variation: selectedVariation
      };

      currentItem = {
        ...currentItem,
        variation: newVariation,
        variation_id: action.payload.variation_id
      };
    }

    const productQty = currentItem.variation ? currentItem.variation.quantity : currentItem.product.quantity;
    const newQuantity = action.payload.quantity;

    if (productQty < newQuantity) {
      this.notificationService.showError(`You can not add more items than available. In stock ${productQty} items.`);
      return false;
    }

    if (newQuantity < 1) {
      this.store.dispatch(new DeleteCart(action.payload.id!));
      return of();
    }

    const updatedItem = {
      ...currentItem,
      quantity: newQuantity,
      sub_total: newQuantity * (currentItem.variation ? currentItem.variation.sale_price : currentItem.product.sale_price)
    };

    items[index] = updatedItem;
    const total = items.reduce((prev, curr) => prev + Number(curr.sub_total), 0);

    ctx.patchState({
      ...state,
      items: items,
      total: total
    });

    if (!this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      return;
    }
    return this.cartService.replaceCart(action.payload).pipe(
      tap({
        error: err => {
          throw new Error(err?.error?.message);
        }
      })
    );
  }

  @Action(DeleteCart)
  delete(ctx: StateContext<CartStateModel>, { id }: DeleteCart) {
    const state = ctx.getState();

    let cart = state.items.filter(value => value.id !== id);
    let total = cart.reduce((prev, curr: Cart) => {
      return (prev + Number(curr.sub_total));
    }, 0);

    ctx.patchState({
      items: cart,
      is_digital_only: state.items.map(item => item.product && item?.product?.product_type).every(item => item == 'digital'),
      total: total
    });

    if (!this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      return;
    }

    return this.cartService.deleteCart(id).pipe(
      tap({
        error: err => {
          throw new Error(err?.error?.message);
        }
      })
    );
  }

  @Action(SyncCart)
  syncCart(ctx: StateContext<CartStateModel>, action: SyncCart) {
    return this.cartService.syncCart(action.payload).pipe(
      tap({
        complete: () => {
          this.store.dispatch(new GetCartItems());
        },
        error: err => {
          throw new Error(err?.error?.message);
        }
      })
    );
  }

  @Action(CloseStickyCart)
  closeStickyCart(ctx: StateContext<CartStateModel>) {
    const state = ctx.getState();
    ctx.patchState({
      ...state,
      stickyCartOpen: false,
    });
  }

  @Action(ToggleSidebarCart)
  toggleSidebarCart(ctx: StateContext<CartStateModel>, { value }: ToggleSidebarCart) {
    const state = ctx.getState();
    ctx.patchState({
      ...state,
      sidebarCartOpen: value,
    });
  }

  @Action(ClearCart)
  clearCart(ctx: StateContext<CartStateModel>) {
    if (!this.store.selectSnapshot(state => state.auth && state.auth.access_token)) {
      return ctx.patchState({
        items: [],
        total: 0
      });
    } else {
      return this.cartService.clearCart().pipe(
        tap({
          next: result => {
            return ctx.patchState({
              items: [],
              total: 0
            });
          },
          error: err => {
            throw new Error(err?.error?.message);
          }
        })
      );
    }
  }

}
