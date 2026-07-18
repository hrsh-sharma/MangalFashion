import { Component, ElementRef, TemplateRef, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { Store, Select } from '@ngxs/store';
import { FormBuilder, FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { Select2Data, Select2UpdateEvent } from 'ng-select2-component';
import { Router } from '@angular/router';
import { Observable, Subscription, map, of } from 'rxjs';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { AccountUser } from "../../../shared/interface/account.interface";
import { AccountState } from '../../../shared/state/account.state';
import { CartState } from '../../../shared/state/cart.state';
import { OrderState } from '../../../shared/state/order.state';
import { Checkout, PlaceOrder } from '../../../shared/action/order.action';
import { Register } from '../../../shared/action/auth.action';
import { GetUserDetails } from '../../../shared/action/account.action';
import { ClearCart } from '../../../shared/action/cart.action';
import { AddressModalComponent } from '../../../shared/components/widgets/modal/address-modal/address-modal.component';
import { Cart } from '../../../shared/interface/cart.interface';
import { SettingState } from '../../../shared/state/setting.state';
import { GetSettingOption } from '../../../shared/action/setting.action';
import { OrderCheckout } from '../../../shared/interface/order.interface';
import { Values, DeliveryBlock } from '../../../shared/interface/setting.interface';
import { CartService } from '../../../shared/services/cart.service';
import { CountryState } from '../../../shared/state/country.state';
import { StateState } from '../../../shared/state/state.state';
import { AuthState } from '../../../shared/state/auth.state';
import * as data from '../../../shared/data/country-code';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer } from '@angular/platform-browser';
import { interval } from 'rxjs';
import { delay, switchMap, takeWhile, tap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OrderService } from '../../../shared/services/order.service';
import { v4 as uuidv4 } from 'uuid';
// import { PaymentInitModal } from 'pg-test-project';
// import * as React from 'react';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent {

  public breadcrumb: Breadcrumb = {
    title: "Checkout",
    items: [{ label: 'Checkout', active: true }]
  }

  @Select(AccountState.user) user$: Observable<AccountUser>;
  @Select(AuthState.accessToken) accessToken$: Observable<string>;
  @Select(CartState.cartItems) cartItem$: Observable<Cart[]>;
  @Select(OrderState.checkout) checkout$: Observable<OrderCheckout>;
  @Select(SettingState.setting) setting$: Observable<Values>;
  @Select(CartState.cartHasDigital) cartDigital$: Observable<boolean | number>;
  @Select(CartState.cartTotal) cartTotal$: Observable<number>;
  @Select(CountryState.countries) countries$: Observable<Select2Data>;

  @ViewChild("addressModal") AddressModal: AddressModalComponent;
  @ViewChild('cpn', { static: false }) cpnRef: ElementRef<HTMLInputElement>;
  @ViewChild("payByQRModal") payByQRModal: TemplateRef<any>;

  public form: FormGroup;
  public coupon: boolean = true;
  public couponCode: string;
  public appliedCoupon: boolean = false;
  public couponError: string | null;
  public checkoutTotal: OrderCheckout;
  public loading: boolean = false;
  private checkoutInProgress: boolean = false;

  public shippingStates$: Observable<Select2Data>;
  public billingStates$: Observable<Select2Data>;
  public codes = data.countryCodes;

  public formData!: any;

  private pollingSubscription!: Subscription;
  private pollingInterval = 5000; // Poll every 5 seconds

  storeData: any;
  localUserCheck: any;

  payByNeoKredIntentSaveData: any;
  payByNeoStep = 0;
  payment_method = '';

  // QR Code Payment Data
  qrCodeData: any = null;
  qrCodeTimerInterval: any = null;
  private timerSubscription: Subscription | null = null;
  public upiCountdown: number = 0;

  // Sub Paisa Config
  // @ViewChild('SubPaisaSdk', { static: true }) containerRef!: ElementRef;
  // formData = {
  //   env: 'stag',
  //   clientCode: 'LPS01',
  //   onToggle:() =>this.render(false) 
  // };
  // reactRoot: any = null;

  constructor(
    private store: Store, private router: Router,
    private formBuilder: FormBuilder, public cartService: CartService,
    private modalService: NgbModal,
    private sanitizer: DomSanitizer,
    private orderService: OrderService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.store.dispatch(new GetSettingOption());

    this.form = this.formBuilder.group({
      products: this.formBuilder.array([], [Validators.required]),
      shipping_address_id: new FormControl('', [Validators.required]),
      billing_address_id: new FormControl('', [Validators.required]),
      points_amount: new FormControl(false),
      wallet_balance: new FormControl(false),
      coupon: new FormControl(),
      delivery_description: new FormControl('', [Validators.required]),
      delivery_interval: new FormControl(),
      payment_method: new FormControl('', [Validators.required]),
      create_account: new FormControl(false),
      name: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      country_code: new FormControl('91', [Validators.required]),
      phone: new FormControl('', [Validators.required]),
      password: new FormControl(),
      shipping_address: new FormGroup({
        title: new FormControl('', [Validators.required]),
        floor_no: new FormControl(''),
        flat_no: new FormControl(''),
        building: new FormControl(''),
        road: new FormControl(''),
        street: new FormControl('', [Validators.required]),
        city: new FormControl('', [Validators.required]),
        phone: new FormControl('', [Validators.required]),
        pincode: new FormControl('', [Validators.required]),
        country_code: new FormControl('91', [Validators.required]),
        country_id: new FormControl('', [Validators.required]),
        state_id: new FormControl('', [Validators.required]),
      }),
      billing_address: new FormGroup({
        same_shipping: new FormControl(false),
        title: new FormControl('', [Validators.required]),
        floor_no: new FormControl(''),
        flat_no: new FormControl(''),
        building: new FormControl(''),
        road: new FormControl(''),
        street: new FormControl('', [Validators.required]),
        city: new FormControl('', [Validators.required]),
        phone: new FormControl('', [Validators.required]),
        pincode: new FormControl('', [Validators.required]),
        country_code: new FormControl('91', [Validators.required]),
        country_id: new FormControl('', [Validators.required]),
        state_id: new FormControl('', [Validators.required]),
      })
    });

    this.store.selectSnapshot(state => state.setting).setting.activation.guest_checkout = true;
    this.updateFormConfiguration();
    this.getBillingAddressSyncSubscription();
  }

  private getBillingAddressSyncSubscription() {
    this.form.get('billing_address.same_shipping')?.valueChanges.subscribe(value => {
      if (value) {
        this.form.get('billing_address.title')?.setValue(this.form.get('shipping_address.title')?.value);
        this.form.get('billing_address.floor_no')?.setValue(this.form.get('shipping_address.floor_no')?.value);
        this.form.get('billing_address.flat_no')?.setValue(this.form.get('shipping_address.flat_no')?.value);
        this.form.get('billing_address.building')?.setValue(this.form.get('shipping_address.building')?.value);
        this.form.get('billing_address.road')?.setValue(this.form.get('shipping_address.road')?.value);
        this.form.get('billing_address.street')?.setValue(this.form.get('shipping_address.street')?.value);
        this.form.get('billing_address.country_id')?.setValue(this.form.get('shipping_address.country_id')?.value);
        this.form.get('billing_address.state_id')?.setValue(this.form.get('shipping_address.state_id')?.value);
        this.form.get('billing_address.city')?.setValue(this.form.get('shipping_address.city')?.value);
        this.form.get('billing_address.pincode')?.setValue(this.form.get('shipping_address.pincode')?.value);
        this.form.get('billing_address.country_code')?.setValue(this.form.get('shipping_address.country_code')?.value);
        this.form.get('billing_address.phone')?.setValue(this.form.get('shipping_address.phone')?.value);
      } else {
        this.form.get('billing_address.title')?.setValue('');
        this.form.get('billing_address.floor_no')?.setValue('');
        this.form.get('billing_address.flat_no')?.setValue('');
        this.form.get('billing_address.building')?.setValue('');
        this.form.get('billing_address.road')?.setValue('');
        this.form.get('billing_address.street')?.setValue('');
        this.form.get('billing_address.country_id')?.setValue('');
        this.form.get('billing_address.state_id')?.setValue('');
        this.form.get('billing_address.city')?.setValue('');
        this.form.get('billing_address.pincode')?.setValue('');
        this.form.get('billing_address.country_code')?.setValue('');
        this.form.get('billing_address.phone')?.setValue('');
      }
    });

    this.cartService.getUpdateQtyClickEvent().subscribe(() => {
      this.products();
      // Only call checkout if payment method is already selected
      if (this.form.controls['payment_method'].value && this.form.controls['payment_method'].value.trim() !== '') {
        this.checkout();
      }
    });

    this.form.controls['phone']?.valueChanges.subscribe((value) => {
      if (value && value.toString().length > 10) {
        this.form.controls['phone']?.setValue(+value.toString().slice(0, 10));
      }
    });

    this.form.get('shipping_address.phone')?.valueChanges.subscribe((value) => {
      if (value && value.toString().length > 10) {
        this.form.get('shipping_address.phone')?.setValue(+value.toString().slice(0, 10));
      }
    });

    this.form.get('billing_address.phone')?.valueChanges.subscribe((value) => {
      if (value && value.toString().length > 10) {
        this.form.get('billing_address.phone')?.setValue(+value.toString().slice(0, 10));
      }
    });

    this.localUserCheck = JSON.parse(localStorage.getItem('account') || '');

  }

  get productControl(): FormArray {
    return this.form.get("products") as FormArray;
  }

  // private render(isOpen: boolean){
  //   this.reactRoot.render(
  //     React.createElement(PaymentInitModal, { ...this.formData as any, isOpen })
  //   )
  // }

  public currentCartTotal: number = 0;

  ngOnInit() {
    this.checkout$.subscribe(data => {
      this.checkoutTotal = data;
      this.validateMinAmount();
    });

    // Also check when cart total changes (fallback)
    this.cartTotal$.subscribe((total) => {
      this.currentCartTotal = total || 0;
      this.validateMinAmount();
    });

    this.products();
  }

  validateMinAmount() {
    let total = 0;

    // Use checkout total if available, otherwise fallback to cart total
    if (this.checkoutTotal && this.checkoutTotal.total && this.checkoutTotal.total.total) {
      total = Number(this.checkoutTotal.total.total);
    } else if (this.currentCartTotal) {
      total = Number(this.currentCartTotal);
    }

    if (total > 0 && total < 200) {
      this.minOrderError = 'Minimum payment limit is ₹200';
    } else {
      this.minOrderError = null;
    }
  }

  products() {
    this.cartItem$.subscribe(items => {
      this.productControl.clear();
      items.forEach((item: Cart) =>
        this.productControl.push(
          this.formBuilder.group({
            product_id: new FormControl(item?.product_id, [Validators.required]),
            variation_id: new FormControl(item?.variation_id ? item?.variation_id : ''),
            quantity: new FormControl(item?.quantity),
          })
        ));
      // Don't trigger checkout on page load - wait for payment method selection
    });
  }

  selectShippingAddress(id: number) {
    if (id) {
      // The address_id controls are removed when the form is configured for guest
      // checkout. A saved address can still be auto-selected (e.g. after adding one),
      // so ensure the control exists before setValue to avoid an undefined crash.
      if (!this.form.contains('shipping_address_id')) {
        this.form.addControl('shipping_address_id', new FormControl('', [Validators.required]));
      }
      this.form.controls['shipping_address_id'].setValue(Number(id));
      // Only call checkout if payment method is already selected
      if (this.form.controls['payment_method']?.value && this.form.controls['payment_method'].value.trim() !== '') {
        this.checkout();
      }
    }
  }

  selectBillingAddress(id: number) {
    if (id) {
      if (!this.form.contains('billing_address_id')) {
        this.form.addControl('billing_address_id', new FormControl('', [Validators.required]));
      }
      this.form.controls['billing_address_id'].setValue(Number(id));
      // Only call checkout if payment method is already selected
      if (this.form.controls['payment_method']?.value && this.form.controls['payment_method'].value.trim() !== '') {
        this.checkout();
      }
    }
  }

  selectDelivery(value: DeliveryBlock) {
    this.form.controls['delivery_description'].setValue(value?.delivery_description);
    this.form.controls['delivery_interval'].setValue(value?.delivery_interval);
    // Only call checkout if payment method is already selected
    if (this.form.controls['payment_method'].value && this.form.controls['payment_method'].value.trim() !== '') {
      this.checkout();
    }
  }

  selectPaymentMethod(value: string) {
    this.form.controls['payment_method'].setValue(value);
    this.payment_method = value;
    // Call checkout when payment method is selected
    this.checkout(value);

    switch (value) {
      case 'neoKred':
        break;
      case 'sub_paisa':
        break;
      case 'cash_free':
        break;
      case 'zyaada_pay':
        break;
      case 'ease_buzz':
        break;
      case 'neoKred2':
        break;
      case 'mangal fashion_nabu':
        break;
      case 'pay_drill':
        break;
      case 'star_mangal':
        break;
      case 'payrise_mangalfashion_jio':
        break;
      default:
        break;
    }
  }

  // SubPaisa
  initiateSubPaisa(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const payload = {
      uuid,
      ...JSON.parse(userData || '').user,
      checkout: this.checkoutTotal
    }
    this.cartService.initiateSubPaisa(
      {
        uuid: payload.uuid,
        email: payload.email,
        total: this.checkoutTotal?.total?.total,
        phone: JSON.parse(userData || '').user.phone,
        name: JSON.parse(userData || '').user.name,
        address: JSON.parse(userData || '').user.address[0].city + ' ' + JSON.parse(userData || '').user.address[0].area
      }
    ).subscribe({
      next: (data) => {
        if (data) {
          this.formData = this.sanitizer.bypassSecurityTrustHtml(data?.data);
          const container = document.getElementById('paymentContainer');

          if (container) {
            container.innerHTML = data.data;
            const form = container.querySelector('form') as HTMLFormElement;

            // Store payment info in session storage
            sessionStorage.setItem('payment_uuid', uuid);
            sessionStorage.setItem('payment_method', payment_method);
            sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
            localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
            // Submit the form in the current window
            form.target = '_self';
            form.submit();
          }
        }
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  // NeoKred
  initiateNeoKredPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateNeoKredIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const cashFreeData = response.data;

            if (cashFreeData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Open in current tab
              window.location.href = cashFreeData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing CashFree response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  // Ease Buzz
  initiateEaseBuzzPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateEaseBuzzIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`,
      phone: parsedUserData.phone,
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const easeBuzzData = response.data;

            if (easeBuzzData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Open in current tab
              window.location.href = easeBuzzData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Ease Buzz response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  // CashFree Payment Integration
  initiateCashFreePaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateCashFreeIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const cashFreeData = response.data;

            if (cashFreeData?.payment_link) {
              // Store payment info in session storage
              localStorage.setItem('payment_uuid', uuid);
              localStorage.setItem('payment_method', payment_method);
              localStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Open in current tab
              window.location.href = cashFreeData.payment_link;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing CashFree response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // Zyaada Pay Payment Integration
  initiateZyaadaPayPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateZyaadaPayIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const zyaadaPayData = response.data;

            if (zyaadaPayData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Open in current tab
              window.location.href = zyaadaPayData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Zyaada Pay response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // NeoKred2
  initiateNeoKred2PaymentIntent(payment_method: string, uuid: any, order_result: any) {
    console.log(payment_method, uuid, order_result);
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateNeoKred2Intent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R && response?.data) {
          try {
            const zyaadaPayData = response.data;

            if (zyaadaPayData?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Open in current tab
              window.location.href = zyaadaPayData.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing Zyaada Pay response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // Star Mangal Payment Integration (Pay via UPI App)
  initiateStarMangalPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateStarMangalIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        const paymentUrl = response?.payment_url || response?.data?.payment_url;
        if (response?.R && paymentUrl) {
          try {
            sessionStorage.setItem('payment_uuid', uuid);
            sessionStorage.setItem('payment_method', payment_method);
            sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
            localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
            sessionStorage.setItem('came_from_checkout_payment', 'true');
            window.location.href = paymentUrl;
          } catch (error) {
            console.error("Error parsing Star Mangal response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // Mangalfashion Jio Payment Integration (Pay by UPI)
  initiateMangalfashionJioPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateMangalfashionJioIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        const qrCode = response?.Qrcode || response?.data?.Qrcode;
        const paymentUrl = response?.url || response?.data?.url;
        
        if (response?.R && qrCode) {
          // Store payment info for later use
          sessionStorage.setItem('payment_uuid', uuid);
          sessionStorage.setItem('payment_method', payment_method);
          sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
          localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
          
          // Open QR code modal
          this.openPaymentQRModal(qrCode, paymentUrl, order_result.order_number);
          
          // Start polling for payment status (check every 1 second)
          this.startPaymentStatusPolling(order_result.order_number, payment_method);
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  openPaymentQRModal(qrCode: string, paymentUrl: string, orderNumber: string) {
    // Always use 5 minutes (300 seconds) – simple and reliable
    const FIVE_MINUTES = 300;

    // Store QR code data – shown inline in the order summary
    this.qrCodeData = {
      qrCode: qrCode,
      paymentUrl: paymentUrl, // Generic (usually works on Android)
      phonepeUrl: paymentUrl.replace('upi://pay?', 'phonepe://pay?'),
      gpayUrl: paymentUrl.replace('upi://pay?', 'tez://pay?'),
      paytmUrl: paymentUrl.replace('upi://pay?', 'paytmmp://pay?'),
      orderNumber: orderNumber
    };

    // Start the 5-minute countdown using RxJS interval
    this.startQRCodeTimer(FIVE_MINUTES);
  }

  startQRCodeTimer(seconds: number) {
    // Cancel any existing timer
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }

    this.upiCountdown = seconds;
    this.cdr.detectChanges(); // Initial update

    // RxJS interval fires every 1 second inside Angular zone
    this.timerSubscription = interval(1000).subscribe(() => {
      this.upiCountdown--;
      
      if (this.upiCountdown <= 0) {
        // QR expired
        const orderNumber = this.qrCodeData?.orderNumber;
        this.stopQRCodeTimer();
        this.qrCodeData = null;
        this.stopPaymentStatusPolling();

        // Redirect to order details
        if (orderNumber) {
          this.redirectToOrderSuccess(orderNumber);
        }
      }
      
      // Explicitly trigger change detection since OnPush/Zone.js might drop ticks
      this.cdr.detectChanges();
    });
  }

  startPaymentStatusPolling(orderNumber: string, paymentMethod: string) {
    // Stop any existing polling
    this.stopPaymentStatusPolling();

    const isJioUPI = paymentMethod === 'payrise_mangalfashion_jio' || paymentMethod === 'mangalfashion_jio';
    const intervalTime = isJioUPI ? 3000 : 1000;

    const pollingInterval = setInterval(() => {
      this.orderService.checkPaymentStatus(orderNumber, paymentMethod).subscribe({
        next: (response) => {
          // Check if payment is completed
          const paymentStatus = response?.payment_status?.toLowerCase();
          const generalStatus = typeof response?.status === 'string' ? response.status.toLowerCase() : '';

          if (
            generalStatus === 'completed' || 
            paymentStatus === 'paid' || 
            paymentStatus === 'completed' || 
            response?.R === true
          ) {
            clearInterval(pollingInterval);
            this.stopPaymentStatusPolling();
            this.stopQRCodeTimer();
            this.qrCodeData = null;

            // Redirect to order details page
            this.redirectToOrderSuccess(orderNumber);
          }
        },
        error: (err) => {
          console.log("Error checking payment status:", err);
          // Continue polling even on error
        }
      });
    }, intervalTime); // Poll every 3 seconds for Jio UPI, else 1 second

    this.pollingSubscription = new Subscription(() => clearInterval(pollingInterval));
  }

  stopPaymentStatusPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null as any;
    }
  }

  stopQRCodeTimer() {
    if (this.qrCodeTimerInterval) {
      clearInterval(this.qrCodeTimerInterval);
      this.qrCodeTimerInterval = null;
    }
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
  }

  redirectToOrderSuccess(orderNumber: string) {
    const userData = localStorage.getItem('account');
    const isGuest = !userData || !(JSON.parse(userData || '{}')?.user);

    if (isGuest) {
      const email = sessionStorage.getItem('payment_action') ? 
        JSON.parse(sessionStorage.getItem('payment_action') || '{}').email : '';
      this.router.navigate(['/order/details'], { 
        queryParams: { 
          order_number: orderNumber,
          email_or_phone: email
        }
      });
    } else {
      this.router.navigateByUrl(`/account/order/details/${orderNumber}`);
    }
  }

  closePaymentQRModal() {
    this.stopPaymentStatusPolling();
    this.stopQRCodeTimer();
    const orderNumber = this.qrCodeData?.orderNumber || '';
    this.qrCodeData = null;
    if (orderNumber) {
      this.router.navigateByUrl(`/account/order/details/${orderNumber}`);
    }
  }

  // NixoPay Payment Integration
  initiateNixoPayPaymentIntent(payment_method: string, uuid: any, order_result: any) {
    const userData = localStorage.getItem('account');
    const parsedUserData = JSON.parse(userData || '{}')?.user || {};

    const payload = {
      uuid,
      ...parsedUserData,
      checkout: this.checkoutTotal
    };

    this.cartService.initiateNixoPayIntent({
      uuid: payload.uuid,
      email: payload.email,
      total: this.checkoutTotal?.total?.total,
      phone: parsedUserData.phone,
      name: parsedUserData.name,
      address: `${parsedUserData.address?.[0]?.city || ''} ${parsedUserData.address?.[0]?.area || ''}`
    }).subscribe({
      next: (response) => {
        if (response?.R) {
          try {
            if (response?.payment_url) {
              // Store payment info in session storage
              sessionStorage.setItem('payment_uuid', uuid);
              sessionStorage.setItem('payment_method', payment_method);
              sessionStorage.setItem('payment_action', JSON.stringify(this.form.value));
              localStorage.setItem('order_id', JSON.stringify(order_result.order_number));
              // Mark that we're redirecting to payment page
              sessionStorage.setItem('came_from_checkout_payment', 'true');
              // Open in current tab
              window.location.href = response.payment_url;
            } else {
              console.error("Invalid response: Payment link is missing.");
            }
          } catch (error) {
            console.error("Error parsing NixoPay response:", error);
          }
        } else {
          console.error("Payment initiation failed:", response?.msg);
        }
      },
      error: (err) => {
        console.log("Error initiating payment:", err);
      }
    });
  }

  // Transaction Status Check for mangal fashion Nabu (and other payment gateways)
  checkTransactionStatusSleekSynergy(uuid: any, paymentWindow: Window | null, payment_method: string) {
    this.pollingSubscription = interval(this.pollingInterval).pipe(
      switchMap(() => this.cartService.checkTransectionStatusNeoKred(uuid, payment_method)),
      takeWhile((response: any) => {
        if (response?.status === true) {
          if (paymentWindow) {
            paymentWindow.close();
          }
          const orderId = localStorage.getItem('order_id');
          if (orderId) {
            this.router.navigate(['/account/order/details', JSON.parse(orderId)]);
          }
          this.pollingSubscription.unsubscribe();
          return false;
        }
        return true;
      }, true)
    ).subscribe({
      error: (err) => {
        console.error('Error checking payment status:', err);
        this.pollingSubscription.unsubscribe();
      }
    });
  }

  async openNeoKredModal(data: any) {
    this.payByNeoKredIntentSaveData = data;
    console.log(this.payByNeoKredIntentSaveData);
    this.modalService.open(this.payByQRModal, {
      ariaLabelledBy: 'address-add-Modal',
      centered: true,
      windowClass: 'theme-modal modal-lg address-modal'
    }).result.then((result) => {
      `Result ${result}`
      const formDataContainer = document.getElementById('formDataContainer');
      console.log(formDataContainer);
    }, (reason) => {
      const formDataContainer = document.getElementById('formDataContainer');
      console.log(formDataContainer);
    });
  }

  payByNeoKredIntentSaveDataUpiIntentString(upi: string) {
    switch (upi) {
      case 'gpay_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "tez://pay?");
      case 'phone_pay_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "phonepe://pay?");
      case 'paytm_upi':
        return this.payByNeoKredIntentSaveData.upiIntentString.replace("upi://pay?", "paytmmp://pay?");
      case 'bhim_upi':
        break;
      // return this.payByNeoKredIntentSaveData.upiIntentString.replace()
      default:
        break;
    }

  }

  paybyNeoNext() {
    this.payByNeoStep = 1;
  }

  paybyNeoDone() {
    this.payByNeoStep = 0;
    this.modalService.dismissAll();
    this.pollingSubscription.unsubscribe();
  }


  togglePoint(event: Event) {
    this.form.controls['points_amount'].setValue((<HTMLInputElement>event.target)?.checked);
    // Only call checkout if payment method is already selected
    if (this.form.controls['payment_method'].value && this.form.controls['payment_method'].value.trim() !== '') {
      this.checkout();
    }
  }

  toggleWallet(event: Event) {
    this.form.controls['wallet_balance'].setValue((<HTMLInputElement>event.target)?.checked);
    // Only call checkout if payment method is already selected
    if (this.form.controls['payment_method'].value && this.form.controls['payment_method'].value.trim() !== '') {
      this.checkout();
    }
  }

  showCoupon() {
    this.coupon = true;
  }

  setCoupon(value?: string) {
    this.couponError = null;

    if (value)
      this.form.controls['coupon'].setValue(value);
    else
      this.form.controls['coupon'].reset();

    this.store.dispatch(new Checkout(this.form.value)).subscribe({
      error: (err) => {
        this.couponError = err.message;
      },
      complete: () => {
        this.appliedCoupon = value ? true : false;
        this.couponError = null;
      }
    });
  }

  couponRemove() {
    this.setCoupon();
  }

  shippingCountryChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      this.shippingStates$ = this.store
        .select(StateState.states)
        .pipe(map(filterFn => filterFn(+data?.value)));
    } else {
      this.form.get('shipping_address.state_id')?.setValue('');
      this.shippingStates$ = of();
    }
  }

  billingCountryChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      this.billingStates$ = this.store
        .select(StateState.states)
        .pipe(map(filterFn => filterFn(+data?.value)));
      if (this.form.get('billing_address.same_shipping')?.value) {
        setTimeout(() => {
          this.form.get('billing_address.state_id')?.setValue(this.form.get('shipping_address.state_id')?.value);
        }, 200);
      }
    } else {
      this.form.get('billing_address.state_id')?.setValue('');
      this.billingStates$ = of();
    }
  }

  checkout(payment_method?: string) {
    // Prevent concurrent checkout calls
    if (this.checkoutInProgress) {
      console.log('Checkout already in progress, skipping...');
      return;
    }

    // If has coupon error while checkout
    if (this.couponError) {
      this.couponError = null;
      this.cpnRef.nativeElement.value = '';
      this.form.controls['coupon'].reset();
    }

    // We allow checkout calculation if at least products are valid
    // This lets guests see their subtotal even before they finish their address
    if (this.productControl.valid && this.productControl.length > 0) {
      this.loading = true;
      this.checkoutInProgress = true;

      // Prepare payload - exclude payment_method if it's empty
      const formValue = { ...this.form.value };
      if (!formValue.payment_method || formValue.payment_method.trim() === '') {
        // Remove payment_method from payload if it's empty (it's optional)
        delete formValue.payment_method;
      }

      // Only clean up optional fields for guest, or if not required
      let isAuthenticated = !!this.store.selectSnapshot(state => state.auth && state.auth.access_token);
      
      if (!isAuthenticated) {
        if (formValue.shipping_address_id === '') {
          delete formValue.shipping_address_id;
        }
        if (formValue.billing_address_id === '') {
          delete formValue.billing_address_id;
        }
      }

      // If logged in, we shouldn't hit the API if addresses are missing but required
      if (isAuthenticated && (!formValue.shipping_address_id || !formValue.billing_address_id)) {
        this.loading = false;
        this.checkoutInProgress = false;
        return;
      }

      this.store.dispatch(new Checkout(formValue)).subscribe({
        next: (value) => {
          this.storeData = value;
        },
        error: (err) => {
          this.loading = false;
          this.checkoutInProgress = false;
          // Don't throw error here to avoid breaking UI, just log it
          console.error('Checkout calculation error:', err);
        },
        complete: () => {
          this.loading = false;
          this.checkoutInProgress = false;
        }
      });
    } else {
      const invalidFields = Object?.keys(this.form?.controls).filter(key => this.form.controls[key].invalid);
      console.log('Form invalid, skipping calculation. Invalid fields:', invalidFields);
    }
  }

  public minOrderError: string | null = null;

  placeorder() {
    // Prevent double submission
    if (this.loading) {
      return;
    }

    // Reset error
    this.minOrderError = null;
    this.validateMinAmount();

    // Validation: Minimum Order Amount
    if (this.minOrderError) {
      return;
    }

    if (this.form.valid) {
      if (this.cpnRef && !this.cpnRef.nativeElement.value) {
        this.form.controls['coupon'].reset();
      }

      const uuid = uuidv4();

      const formData = {
        ...this.form.value,
        uuid: uuid
      }

      // Set loading state to prevent double submission
      this.loading = true;

      // Handle "Create Account" before placing order
      if (this.form.get('create_account')?.value && !(this.store.selectSnapshot(state => state.auth && state.auth.access_token))) {
        const registerPayload = {
          name: this.form.value.name,
          email: this.form.value.email,
          phone: this.form.value.phone,
          country_code: this.form.value.country_code,
          password: this.form.value.password,
          password_confirmation: this.form.value.password // Use password as confirmation
        };

        this.store.dispatch(new Register(registerPayload)).pipe(
          switchMap(() => {
            // Once registered successfully, get the updated user/auth state if needed
            // For now, form values stay the same except we no longer need create_account in payload ideally
            let action = new PlaceOrder(formData);
            return this.orderService.placeOrder(action?.payload);
          }),
          tap({
            next: result => {
              console.log(result);
            },
            error: err => {
              this.loading = false;
              throw new Error(err?.error?.message || err?.message || 'Error occurred');
            }
          })
        ).subscribe({
          next: (result) => {
            this.handlePaymentRedirection(uuid, result);
          },
          error: (err) => {
            this.loading = false;
            console.log(err);
          }
        });
      } else {
        // Proceed normally without registration
        let action = new PlaceOrder(formData);

        this.orderService.placeOrder(action?.payload).pipe(
          tap({
            next: result => {
              console.log(result);
            },
            error: err => {
              this.loading = false; // Reset loading on error
              throw new Error(err?.error?.message || err?.message || 'Error occurred');
            }
          })
        ).subscribe({
          next: (result) => {
            this.handlePaymentRedirection(uuid, result);
          },
          error: (err) => {
            this.loading = false; // Reset loading on error
            console.log(err);
          }
        });
      }
    }
  }

  // Extracted payment redirection logic 
  private handlePaymentRedirection(uuid: string, result: any) {
    if (this.payment_method === 'cash_free') {
      this.initiateCashFreePaymentIntent(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'sub_paisa') {
      this.initiateSubPaisa(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'neoKred') {
      this.initiateNeoKredPaymentIntent(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'zyaada_pay') {
      this.initiateZyaadaPayPaymentIntent(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'ease_buzz') {
      this.initiateEaseBuzzPaymentIntent(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'neoKred2') {
      this.initiateNeoKred2PaymentIntent(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'pay_drill') {
      this.initiateNixoPayPaymentIntent(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'star_mangal') {
      this.initiateStarMangalPaymentIntent(this.payment_method, uuid, result);
    }
    if (this.payment_method === 'payrise_mangalfashion_jio') {
      this.initiateMangalfashionJioPaymentIntent(this.payment_method, uuid, result);
    }
  }

  paybyqr() {
    this.modalService.dismissAll();
    // PlaceOrder Here
  }

  clearCart() {
    this.store.dispatch(new ClearCart());
  }

  filterSpecialCharacters(event: any, fieldName: string) {
    const input = event.target;
    const value = input.value;
    // Allow only letters, numbers, spaces, dots, hyphens, and apostrophes
    const filteredValue = value.replace(/[^a-zA-Z0-9\s\.\-\']/g, '');
    if (value !== filteredValue) {
      input.value = filteredValue;
      // Handle nested form controls
      if (fieldName.includes('.')) {
        const [parent, child] = fieldName.split('.');
        this.form.get(parent)?.get(child)?.setValue(filteredValue);
      } else {
        this.form.get(fieldName)?.setValue(filteredValue);
      }
    }
  }

  registerAccount() {
    this.form.markAllAsTouched();
    if (this.form.controls['name'].valid && 
        this.form.controls['email'].valid && 
        this.form.controls['phone'].valid && 
        this.form.controls['password'].valid) {
      
      this.loading = true;
      const registerPayload = {
        name: this.form.value.name,
        email: this.form.value.email,
        phone: Number(this.form.value.phone),
        country_code: Number(this.form.value.country_code),
        password: this.form.value.password,
        password_confirmation: this.form.value.password
      };

      this.store.dispatch(new Register(registerPayload)).pipe(
        switchMap(() => this.store.dispatch(new GetUserDetails())),
        tap({
          next: () => {
            this.loading = false;
            
            // Refreshes form controls and subscriptions for logged-in state
            this.updateFormConfiguration();
            
            // Re-run the city/area API for the logged-in context
            if (this.AddressModal) {
              this.AddressModal.downloadPINAreaExcelJSON();
            }
            if (this.form.controls['payment_method'].value) {
                this.checkout();
            }
          },
          error: err => {
            this.loading = false;
            console.error('Registration failed:', err);
          }
        })
      ).subscribe();
    } else {
      console.log('Account fields invalid for registration');
    }
  }

  private updateFormConfiguration() {
    const isAuthenticated = !!this.store.selectSnapshot(state => state.auth && state.auth.access_token);

    if (isAuthenticated) {
      // Add controls required for logged-in users
      if (!this.form.contains('shipping_address_id')) {
        this.form.addControl('shipping_address_id', new FormControl('', [Validators.required]));
      }
      if (!this.form.contains('billing_address_id')) {
        this.form.addControl('billing_address_id', new FormControl('', [Validators.required]));
      }
      if (!this.form.contains('points_amount')) {
        this.form.addControl('points_amount', new FormControl(false));
      }
      if (!this.form.contains('wallet_balance')) {
        this.form.addControl('wallet_balance', new FormControl(false));
      }

      // Remove controls that are for guest checkout only
      this.form.removeControl('create_account');
      this.form.removeControl('name');
      this.form.removeControl('email');
      this.form.removeControl('country_code');
      this.form.removeControl('phone');
      this.form.removeControl('password');
      this.form.removeControl('password_confirmation');
      this.form.removeControl('shipping_address');
      this.form.removeControl('billing_address');

      this.cartDigital$.subscribe(value => {
        if (value == 1) {
          this.form.controls['shipping_address_id'].clearValidators();
          this.form.controls['delivery_description'].clearValidators();
        } else {
          this.form.controls['shipping_address_id'].setValidators([Validators.required]);
          this.form.controls['delivery_description'].setValidators([Validators.required]);
        }
        this.form.controls['shipping_address_id'].updateValueAndValidity();
        this.form.controls['delivery_description'].updateValueAndValidity();
      });

    } else {
      // GUEST configuration
      if (this.store.selectSnapshot(state => state.setting).setting.activation.guest_checkout) {
        // Remove controls that are for logged-in users only
        this.form.removeControl('shipping_address_id');
        this.form.removeControl('billing_address_id');
        this.form.removeControl('points_amount');
        this.form.removeControl('wallet_balance');

        // Ensure guest-only controls exist (they should be added in constructor group)
        if (!this.form.contains('name')) {
          this.form.addControl('name', new FormControl('', [Validators.required]));
        }
        if (!this.form.contains('email')) {
          this.form.addControl('email', new FormControl('', [Validators.required, Validators.email]));
        }
        if (!this.form.contains('phone')) {
          this.form.addControl('phone', new FormControl('', [Validators.required]));
        }
        if (!this.form.contains('password')) {
          this.form.addControl('password', new FormControl('', [Validators.required]));
        }

        this.form.controls['password'].updateValueAndValidity();
      }
    }

    // Subscribe to form changes for both states to trigger checkout
    this.form.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => {
        return JSON.stringify({
          products: prev.products,
          shipping_address_id: prev.shipping_address_id,
          billing_address_id: prev.billing_address_id,
          coupon: prev.coupon,
          points_amount: prev.points_amount,
          wallet_balance: prev.wallet_balance,
          delivery_description: prev.delivery_description,
          payment_method: prev.payment_method
        }) === JSON.stringify({
          products: curr.products,
          shipping_address_id: curr.shipping_address_id,
          billing_address_id: curr.billing_address_id,
          coupon: curr.coupon,
          points_amount: curr.points_amount,
          wallet_balance: curr.wallet_balance,
          delivery_description: curr.delivery_description,
          payment_method: curr.payment_method
        });
      })
    ).subscribe(value => {
      if (value.payment_method && value.payment_method.trim() !== '') {
        this.checkout();
      }
    });
  }

  filterEmailCharacters(event: any) {
    const input = event.target;
    const value = input.value;
    // Allow only email-allowed characters: letters, numbers, dot, underscore, hyphen, plus, @
    const filteredValue = value.replace(/[^a-zA-Z0-9._\-+@]/g, '');
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('email')?.setValue(filteredValue);
    }
  }

  ngOnDestroy() {
    // this.store.dispatch(new Clear());
    // this.store.dispatch(new ClearCart());
    this.form.reset();
    this.pollingSubscription && this.pollingSubscription.unsubscribe();
    this.stopPaymentStatusPolling(); // Clean up payment polling and timer
  }

}
