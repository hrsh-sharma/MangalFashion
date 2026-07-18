import { Component, ViewChild, TemplateRef, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { Observable, forkJoin, BehaviorSubject } from 'rxjs';
import { Cart, CartAddOrUpdate } from '../../../../interface/cart.interface';
import { CartState } from '../../../../state/cart.state';
import { AuthState } from '../../../../state/auth.state';
import { ClearCart, UpdateCart, DeleteCart, AddToCart } from '../../../../action/cart.action';
import { AddToWishlist, DeleteWishlist } from '../../../../action/wishlist.action';
import { Router } from '@angular/router';
import { CartService } from '../../../../services/cart.service';
import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../interface/product.interface';
import { Attribute, AttributeValue } from '../../../../interface/attribute.interface';

@Component({
  selector: 'app-cart-popup-modal',
  templateUrl: './cart-popup-modal.component.html',
  styleUrls: ['./cart-popup-modal.component.scss']
})
export class CartPopupModalComponent implements OnDestroy {

  @ViewChild("cartPopupModal", { static: false }) cartPopupModal: TemplateRef<any>;

  public closeResult: string;
  public modalOpen: boolean = false;
  public product: Product | null = null;
  public quantity: number = 1;

  public productAttributes: Attribute[] = [];
  public selectedAttributeValues: { [attributeId: number]: AttributeValue | null } = {};
  public availableAttributeValues: { [attributeId: number]: AttributeValue[] } = {};

  public addToCartLoader: boolean = false;
  public selectedVariationId: number | null = null;
  public selectedVariation: any = null;
  public isAuthenticated: boolean = false;

  get currentPrice(): number {
    // If we have a selected variation, return its sale_price, otherwise return product sale_price
    if (this.selectedVariationId && this.selectedVariation) {
      return this.selectedVariation.sale_price;
    }
    return this.product?.sale_price || 0;
  }

  constructor(
    private modalService: NgbModal,
    private store: Store,
    public cartService: CartService
  ) { }

  async openModal(product: Product) {
    this.modalOpen = true;
    this.product = product;
    this.quantity = 1; // Reset quantity
    this.addToCartLoader = false; // Reset loader

    this.isAuthenticated = !!this.store.selectSnapshot(AuthState.isAuthenticated);

    // Reset all attributes
    this.productAttributes = [];
    this.selectedAttributeValues = {};
    this.availableAttributeValues = {};

    if (this.isAuthenticated && this.product && this.product.attributes) {
      // Get all product attributes (not just size and waist)
      this.productAttributes = this.product.attributes;

      // Initialize selected values and available values for each attribute
      this.productAttributes.forEach(attribute => {
        this.selectedAttributeValues[attribute.id] = null;
        this.availableAttributeValues[attribute.id] = [];
      });

      // Filter available attribute values based on existing variations
      this.filterAvailableAttributeValues();
      // Update selected variation based on default selections
      this.updateSelectedVariation();
    }

    this.modalService.open(this.cartPopupModal, {
      ariaLabelledBy: 'Cart-Popup-Modal',
      centered: true,
      windowClass: this.isAuthenticated ? 'theme-modal cart-popup-modal' : 'theme-modal cart-popup-modal cart-popup-modal-narrow',
      backdrop: 'static',
      keyboard: true
    }).result.then((result) => {
      `Result ${result}`
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  private getDismissReason(reason: ModalDismissReasons): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }

  closeModal() {
    this.modalService.dismissAll();
  }

  filterAvailableAttributeValues() {
    if (!this.product?.variations) return;

    // Reset available values for all attributes
    this.productAttributes.forEach(attribute => {
      this.availableAttributeValues[attribute.id] = [];
    });

    // Filter available values for each attribute
    this.productAttributes.forEach(attribute => {
      this.availableAttributeValues[attribute.id] = attribute.attribute_values.filter(attrValue =>
        this.product!.variations.some(variation =>
          variation.attribute_values.some(variationAttrVal => variationAttrVal.id === attrValue.id)
        )
      );

      // Set default selection for this attribute
      const currentSelection = this.selectedAttributeValues[attribute.id];
      const availableValues = this.availableAttributeValues[attribute.id];
      if (!currentSelection || !availableValues.find(v => v.id === currentSelection.id)) {
        this.selectedAttributeValues[attribute.id] = availableValues.length > 0 ? availableValues[0] : null;
      }
    });

    console.log('🎯 FILTERED AVAILABLE VALUES:', {
      attributes: this.productAttributes.map(attr => ({
        name: attr.name,
        availableValues: this.availableAttributeValues[attr.id].map(v => v.value),
        selectedValue: this.selectedAttributeValues[attr.id]?.value
      }))
    });
  }

  updateQuantity(qty: number) {
    if (this.quantity + qty >= 1) {
      this.quantity += qty;
    }
  }

  selectAttributeValue(attributeId: number, value: AttributeValue) {
    this.selectedAttributeValues[attributeId] = value;
    // Update the selected variation when attributes change
    this.updateSelectedVariation();
  }

  private updateSelectedVariation() {
    if (!this.product?.variations) {
      this.selectedVariationId = null;
      this.selectedVariation = null;
      return;
    }

    // Find variation that matches all selected attributes
    const foundVariation = this.product.variations.find(variation => {
      let match = true;

      // Check each selected attribute value
      for (const [attributeId, selectedValue] of Object.entries(this.selectedAttributeValues)) {
        if (selectedValue) {
          const attrMatch = variation.attribute_values?.some(attrVal => attrVal.id === selectedValue.id);
          if (!attrMatch) {
            match = false;
            break;
          }
        }
      }

      return match;
    });

    if (foundVariation) {
      this.selectedVariationId = foundVariation.id;
      this.selectedVariation = {
        ...foundVariation,
        selected_variation: foundVariation.selected_variation ||
          foundVariation.attribute_values?.map(attr => attr.value)?.filter(value => value)?.join('/') || ''
      };
    } else {
      this.selectedVariationId = null;
      this.selectedVariation = null;
    }
  }

  addToCart() {
    if (this.product) {
      this.addToCartLoader = true; // Start loader
      let selectedVariation: any = null;
      let selectedVariationId: number | null = null;

      // If product has variations
      if (this.product.type === 'classified' && this.product.variations && this.product.variations.length > 0) {

        // Find variation that matches all selected attributes
        console.log('🔍 VARIATION SEARCH - Looking for:', {
          selectedAttributes: Object.entries(this.selectedAttributeValues).map(([attrId, value]) => ({
            attributeId: attrId,
            selectedValue: value?.value
          })),
          productVariations: this.product.variations?.length
        });

        // Debug: Log all variations and their attribute values
        this.product.variations?.forEach((variation, index) => {
          console.log(`Variation ${index + 1}:`, {
            id: variation.id,
            name: variation.name,
            attribute_values: variation.attribute_values,
            selected_variation: variation.selected_variation
          });
        });

        const foundVariation = this.product.variations.find(variation => {
          let match = true;

          // Check each selected attribute value
          for (const [attributeId, selectedValue] of Object.entries(this.selectedAttributeValues)) {
            if (selectedValue) {
              const attrMatch = variation.attribute_values?.some(attrVal => attrVal.id === selectedValue.id);
              console.log(`Attribute ${attributeId} check for variation ${variation.id}:`, {
                selectedValueId: selectedValue.id,
                variationAttrIds: variation.attribute_values?.map(v => v.id),
                match: attrMatch
              });
              if (!attrMatch) {
                match = false;
                break;
              }
            }
          }

          console.log(`Variation ${variation.id} match result:`, match);
          return match;
        });

        if (foundVariation) {
          selectedVariation = {
            ...foundVariation,
            // Ensure selected_variation is set if missing
            selected_variation: foundVariation.selected_variation ||
              foundVariation.attribute_values?.map(attr => attr.value)?.filter(value => value)?.join('/') || ''
          };
          selectedVariationId = foundVariation.id;
          console.log('✅ CART POPUP - FOUND Variation:', {
            id: foundVariation.id,
            name: foundVariation.name,
            attribute_values: foundVariation.attribute_values,
            original_selected_variation: foundVariation.selected_variation,
            constructed_selected_variation: selectedVariation.selected_variation
          });
        } else {
          console.log('❌ CART POPUP - NO Variation found for selected attributes');
        }
      }

      const params: CartAddOrUpdate = {
        id: null, // New item
        product: this.product,
        product_id: this.product.id,
        variation_id: selectedVariationId,
        variation: selectedVariation,
        quantity: this.quantity
      }

      console.log('🛒 CART POPUP - Adding to Cart:', {
        product_name: this.product?.name,
        variation_id: selectedVariationId,
        variation: selectedVariation,
        params: params
      });

      this.store.dispatch(new AddToCart(params)).subscribe({
        complete: () => {
          this.addToCartLoader = false; // Stop loader
          this.closeModal();
        },
        error: () => {
          this.addToCartLoader = false; // Stop loader on error
        }
      });
    }
  }

  toggleWishlist(product: Product) {
    product['is_wishlist'] = !product['is_wishlist'];
    let action = product['is_wishlist'] ? new AddToWishlist({ product_id: product.id }) : new DeleteWishlist(product.id);
    if (action) {
      this.store.dispatch(action);
    }
  }

  ngOnDestroy() {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }
}

