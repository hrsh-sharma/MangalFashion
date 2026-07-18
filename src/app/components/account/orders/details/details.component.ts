import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { Observable, Subject, of, Subscription, interval } from 'rxjs';
import { switchMap, mergeMap, takeUntil, takeWhile } from 'rxjs/operators';
import { DownloadInvoice, ViewOrder } from '../../../../shared/action/order.action';
import { GetOrderStatus } from '../../../../shared/action/order-status.action';
import { OrderState } from '../../../../shared/state/order.state';
import { OrderStatusState } from '../../../../shared/state/order-status.state';
import { Order } from '../../../../shared/interface/order.interface';
import { OrderStatusModel } from '../../../../shared/interface/order-status.interface';
import { RefundModalComponent } from '../../../../shared/components/widgets/modal/refund-modal/refund-modal.component';
import { PayModalComponent } from '../../../../shared/components/widgets/modal/pay-modal/pay-modal.component';
import { CartService } from '../../../../shared/services/cart.service';
import { CountryState } from '../../../../shared/state/country.state';
import { StateState } from '../../../../shared/state/state.state';
import { Country, CountryModel } from '../../../../shared/interface/country.interface';
import { States, StatesModel } from '../../../../shared/interface/state.interface';

@Component({
  selector: 'app-order-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class OrderDetailsComponent {

  @Select(OrderStatusState.orderStatus) orderStatus$: Observable<OrderStatusModel>;
  @Select(CountryState.country) country$: Observable<CountryModel>;
  @Select(StateState.state) state$: Observable<StatesModel>;
  @ViewChild("refundModal") RefundModal: RefundModalComponent;
  @ViewChild("payModal") PayModal: PayModalComponent;

  private destroy$ = new Subject<void>();
  private pollingSubscription!: Subscription;
  private orderSubscription!: Subscription;
  private pollingInterval = 15000; // Poll every 15 seconds (further reduced)
  public isLogin: boolean;

  public order: Order;
  public loading = true;

  public countries: Country[] = [];
  public states: States[] = [];

  // Computed properties for better performance
  get canDownloadInvoice(): boolean {
    return !!(this.order?.invoice_url &&
              this.order?.payment_status === 'COMPLETED' &&
              this.isLogin);
  }

  get canPayNow(): boolean {
    return !!(this.order?.payment_status === 'FAILED' || this.order?.payment_status === 'PENDING') &&
           (this.order?.order_status && this.order?.order_status?.slug != 'cancelled') &&
           this.order?.payment_method != 'cod';
  }

  get showTracking(): boolean {
    return !!(this.order && !this.order?.sub_orders?.length);
  }

  constructor(private store: Store,
    private route: ActivatedRoute,
    private cartService: CartService) {
    this.store.dispatch(new GetOrderStatus());
    this.country$.subscribe(country => this.countries = country.data);
    this.state$.subscribe(state => this.states = state.data);
  }

  ngOnInit() {
    this.isLogin = !!this.store.selectSnapshot(state => state.auth && state.auth.access_token)

    // Get order ID from route params
    this.route.params.subscribe(params => {
      if (params['id']) {
        // Clean up previous subscription
        if (this.orderSubscription) {
          this.orderSubscription.unsubscribe();
        }

        // Check if we already have this order in the store to avoid unnecessary API calls
        const currentOrder = this.store.selectSnapshot(OrderState.selectedOrder);
        if (currentOrder && currentOrder.id === +params['id']) {
          this.order = currentOrder;
          this.loading = false;
          this.checkPaymentStatusIfNeeded();
          this.clearPaymentDataIfNeeded();
        } else {
          // Only dispatch if we don't have the order or it's different
          this.store.dispatch(new ViewOrder(params['id'])).subscribe(() => {
            this.orderSubscription = this.store.select(OrderState.selectedOrder)
              .pipe(takeUntil(this.destroy$))
              .subscribe(order => {
                if (order) {
                  this.order = order;
                  this.loading = false;
                  this.checkPaymentStatusIfNeeded();
                  this.clearPaymentDataIfNeeded();
                }
              });
          });
        }
      }
    });
  }

  getCountryName(id: number) {
    return this.countries.find(country => country.id == id)?.name;
  }

  getStateName(id: number) {
    return this.states.find(state => state.id == id)?.name;
  }

  private checkPaymentStatusIfNeeded() {
    // Only start polling for specific payment methods that need status checking
    // and only if the order is not already completed
    if (this.order &&
        this.order.payment_method === 'mangal fashion_nabu' &&
        (this.order.payment_status === 'PENDING' || this.order.payment_status === 'PROCESSING') &&
        this.order.uuid &&
        this.order.order_status?.slug !== 'delivered' &&
        this.order.order_status?.slug !== 'cancelled') {
      // Add a longer delay before starting polling to improve initial page load
      setTimeout(() => {
        this.checkPaymentStatus();
      }, 3000);
    }
  }

  private clearPaymentDataIfNeeded() {
    // Clear payment-related data when user successfully reaches order details
    // This prevents issues with back navigation from payment pages
    const cameFromPayment = sessionStorage.getItem('came_from_checkout_payment');
    const hasPaymentData = sessionStorage.getItem('payment_uuid') || localStorage.getItem('order_id');

    if (cameFromPayment || hasPaymentData) {
      // Clear all payment-related data
      localStorage.removeItem('order_id');
      localStorage.removeItem('payment_uuid');
      localStorage.removeItem('payment_method');
      sessionStorage.removeItem('payment_uuid');
      sessionStorage.removeItem('payment_method');
      sessionStorage.removeItem('payment_action');
      sessionStorage.removeItem('came_from_checkout_payment');
    }
  }

  checkPaymentStatus() {
    if (!this.order || !this.order.uuid) return;

    // Stop any existing polling
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }

    let maxAttempts = 20; // Poll for maximum 5 minutes (20 attempts * 15 seconds)
    let attemptCount = 0;

    this.pollingSubscription = interval(this.pollingInterval).pipe(
      switchMap(() => {
        attemptCount++;
        // Check if order is already completed before making API call
        if (this.order?.payment_status === 'COMPLETED' || this.order?.payment_status === 'paid') {
          return of({ status: true }); // Skip API call if already completed
        }
        return this.cartService.checkTransectionStatusNeoKred(this.order.uuid!, this.order.payment_method);
      }),
      takeWhile((response: any) => {
        // Stop if payment is completed, order is cancelled/delivered, or max attempts reached
        if (response?.status === true ||
            attemptCount >= maxAttempts ||
            this.order?.order_status?.slug === 'delivered' ||
            this.order?.order_status?.slug === 'cancelled') {
          if (response?.status === true && this.order?.id) {
            // Payment completed, refresh the order once
            this.store.dispatch(new ViewOrder(this.order.id)).subscribe(() => {
              this.store.select(OrderState.selectedOrder)
                .pipe(takeUntil(this.destroy$))
                .subscribe(updatedOrder => {
                  if (updatedOrder) {
                    this.order = updatedOrder;
                }
              });
            });
          }
          return false;
        }
        // Stop if max attempts reached
        if (attemptCount >= maxAttempts) {
          console.warn('Payment status check timeout after maximum attempts');
          return false;
        }
        // Continue polling if payment is still pending
        return this.order?.payment_status === 'PENDING';
      }, true)
    ).subscribe({
      error: (err) => {
        console.error('Error checking payment status:', err);
        this.pollingSubscription.unsubscribe();
      }
    });
  }

  download(id: number){
    this.store.dispatch(new DownloadInvoice({order_number: id}))
  }

  ngOnDestroy() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.orderSubscription) {
      this.orderSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

}
