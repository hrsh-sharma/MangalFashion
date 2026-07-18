import { Component, ElementRef, TemplateRef, ViewChild } from '@angular/core';
import { Store, Select } from '@ngxs/store';
import { FormBuilder, FormControl, FormGroup, Validators, FormArray } from '@angular/forms';
import { Select2Data, Select2UpdateEvent } from 'ng-select2-component';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, map, of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer } from '@angular/platform-browser';
import { interval } from 'rxjs';
import { delay, switchMap, takeUntil, takeWhile, tap } from 'rxjs/operators';
import { Breadcrumb } from '../../../../shared/interface/breadcrumb';
import { OrderService } from '../../../../shared/services/order.service';
import { CartService } from '../../../../shared/services/cart.service';
import { GetSettingOption } from '../../../../shared/action/setting.action';
import { DeliveryBlock } from '../../../../shared/interface/setting.interface';

@Component({
  selector: 'app-checkout-success',
  templateUrl: './checkout-success.component.html',
  styleUrls: ['./checkout-success.component.scss']
})
export class CheckoutSuccessComponent {

  private destroy$ = new Subject<void>();

  public breadcrumb: Breadcrumb = {
    title: "Checkout",
    items: [{ label: 'Checkout', active: true }]
  }
 
  public form: FormGroup;
  public coupon: boolean = true;
  public couponCode: string;
  public appliedCoupon: boolean = false;
  public couponError: string | null;
  public loading: boolean = false;

  public shippingStates$: Observable<Select2Data>;
  public billingStates$: Observable<Select2Data>;

  public formData!: any;

  private pollingSubscription!: Subscription;
  private pollingInterval = 5000; // Poll every 5 seconds

  order_status: boolean;

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
        private route: ActivatedRoute
      ) {


    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(params => {
        this.order_status = params['order_status'];
        console.log(this.order_status);
      });
    
  }

  get productControl(): FormArray {
    return this.form.get("products") as FormArray;
  }

  // private render(isOpen: boolean){
  //   this.reactRoot.render(
  //     React.createElement(PaymentInitModal, { ...this.formData as any, isOpen })
  //   )
  // }

  ngOnInit() {
    this.checkPaymentStatus();
    this.products();
  }

  checkPaymentStatus() {
    // Check if we have payment data from a recent payment attempt
    const paymentUuid = sessionStorage.getItem('payment_uuid') || localStorage.getItem('payment_uuid');
    const paymentMethod = sessionStorage.getItem('payment_method') || localStorage.getItem('payment_method');
    const orderId = localStorage.getItem('order_id');

    if (paymentUuid && paymentMethod && orderId) {
      let pollCount = 0;
      const maxPolls = 60; // Stop polling after 5 minutes (60 * 5 seconds)

      // Poll for payment status
      this.pollingSubscription = interval(this.pollingInterval).pipe(
        switchMap(() => {
          pollCount++;
          if (paymentMethod === 'pay_drill') {
            return this.cartService.checkNixoPayPaymentStatus(paymentUuid, paymentMethod);
          } else {
            return this.cartService.checkTransectionStatusNeoKred(paymentUuid, paymentMethod);
          }
        }),
        takeWhile((response: any) => {
          // Stop polling if payment is successful or we've exceeded max polls
          if (response?.status === true || response?.R === true) {
            // Payment successful - redirect to success page with order ID
            const parsedOrderId = JSON.parse(orderId);
            this.clearPaymentData();
            this.router.navigate(['/success'], { queryParams: { order_id: parsedOrderId } });
            this.pollingSubscription.unsubscribe();
            return false;
          }
          // Continue polling if under max polls
          return pollCount < maxPolls;
        }, true)
      ).subscribe({
        error: (err) => {
          console.error('Error checking payment status:', err);
          this.pollingSubscription.unsubscribe();
        }
      });
    }
  }

  private clearPaymentData() {
    localStorage.removeItem('order_id');
    localStorage.removeItem('payment_uuid');
    localStorage.removeItem('payment_method');
    sessionStorage.removeItem('payment_uuid');
    sessionStorage.removeItem('payment_method');
    sessionStorage.removeItem('payment_action');
    sessionStorage.removeItem('came_from_checkout_payment');
  }

  products() {
    //
  }

  goToHome() {
    this.router.navigateByUrl('/');
  }

  selectShippingAddress(id: number) {
    if(id) {
      this.form.controls['shipping_address_id'].setValue(Number(id));
    }
  }

  selectBillingAddress(id: number) {
    if(id) {
      this.form.controls['billing_address_id'].setValue(Number(id));
    }
  }

  selectDelivery(value: DeliveryBlock) {
    this.form.controls['delivery_description'].setValue(value?.delivery_description);
    this.form.controls['delivery_interval'].setValue(value?.delivery_interval);
  }

  selectPaymentMethod(value: string) {
    this.form.controls['payment_method'].setValue(value);
    // this.checkout();
    switch (value) {
      case 'payment_by_qr':
        // Call Popup for QR Code
        this.openModal();
        break;
      case 'sub_paisa':
        // this.openModal();
        break;  
      default:
        break;
    }
  }

  async openModal() {
    // this.modalService.open(this.payByQRModal, {
    //   ariaLabelledBy: 'address-add-Modal',
    //   centered: true,
    //   windowClass: 'theme-modal modal-lg address-modal'
    // }).result.then((result) => {
    //   `Result ${result}`
    //   const formDataContainer = document.getElementById('formDataContainer');
    //   console.log(formDataContainer);
    // }, (reason) => {
    //   const formDataContainer = document.getElementById('formDataContainer');
    //   console.log(formDataContainer);
    // });
  }


  togglePoint(event: Event) {
    this.form.controls['points_amount'].setValue((<HTMLInputElement>event.target)?.checked);
  }

  toggleWallet(event: Event) {
    this.form.controls['wallet_balance'].setValue((<HTMLInputElement>event.target)?.checked);
  }

  showCoupon() {
    this.coupon = true;
  }

  setCoupon(value?: string) {
    //
  }

  couponRemove() {
    this.setCoupon();
  }

  clearCart(){
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

}
