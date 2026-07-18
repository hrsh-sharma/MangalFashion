import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { CartService } from '../../../shared/services/cart.service';
import { OrderService } from '../../../shared/services/order.service';

@Component({
  selector: 'app-payment-success',
  templateUrl: './payment-success.component.html',
  styleUrls: ['./payment-success.component.scss']
})
export class PaymentSuccessComponent implements OnInit, OnDestroy {

  public breadcrumb: Breadcrumb = {
    title: "Payment Successful",
    items: [{ label: 'Payment Successful', active: true }]
  };

  public orderId: string | null = null;
  public orderDetails: any = null;
  public loading = true;
  public paymentVerified = false;
  public redirectCountdown = 5; // 5 seconds countdown
  public showRedirectMessage = false;

  private pollingSubscription!: Subscription;
  private countdownSubscription!: Subscription;
  private pollingInterval = 3000; // Poll every 3 seconds
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private cartService: CartService,
    private orderService: OrderService
  ) { }

  ngOnInit() {
    // Check if user actually came from a payment process
    const cameFromPayment = sessionStorage.getItem('came_from_checkout_payment');
    const hasPaymentData = sessionStorage.getItem('payment_uuid') || localStorage.getItem('order_id');

    // If no payment data exists, redirect to home - this prevents direct access
    if (!cameFromPayment && !hasPaymentData) {
      this.router.navigate(['/']);
      return;
    }

    // Check URL parameters for order information
    this.route.queryParams.subscribe(params => {
      this.orderId = params['order_id'] || params['order_number'];

      if (this.orderId) {
        this.verifyPaymentAndLoadOrder();
      } else {
        // Check localStorage for stored order data
        this.checkStoredOrderData();
      }
    });
  }

  private checkStoredOrderData() {
    // Check if we have payment data from a recent payment attempt
    const paymentUuid = sessionStorage.getItem('payment_uuid') || localStorage.getItem('payment_uuid');
    const paymentMethod = sessionStorage.getItem('payment_method') || localStorage.getItem('payment_method');
    const storedOrderId = localStorage.getItem('order_id');

    if (paymentUuid && paymentMethod && storedOrderId) {
      this.orderId = JSON.parse(storedOrderId);
      this.verifyPaymentAndLoadOrder();
    } else {
      // No valid payment data found, redirect to home
      this.router.navigate(['/']);
    }
  }

  private verifyPaymentAndLoadOrder() {
    if (!this.orderId) return;

    let pollCount = 0;
    const maxPolls = 40; // Stop polling after ~2 minutes
    const orderIdNumber = parseInt(this.orderId, 10);

    if (isNaN(orderIdNumber)) return;

    // Poll for payment verification and order details
    this.pollingSubscription = interval(this.pollingInterval).pipe(
      switchMap(() => {
        pollCount++;
        // Try to load order details
        return this.orderService.viewOrder(orderIdNumber);
      }),
      takeWhile((order: any) => {
        if (order) {
          // Check if payment status is successful
          if (order.payment_status === 'paid' || order.payment_status === 'completed' || order.order_payment_status === 'paid') {
            this.orderDetails = order;
            this.paymentVerified = true;
            this.loading = false;
            this.clearPaymentData();
            this.pollingSubscription.unsubscribe();
            // Start countdown for automatic redirect
            this.startRedirectCountdown();
            return false;
          }
          // If order exists but payment not verified yet, show order details anyway
          if (!this.orderDetails) {
            this.orderDetails = order;
            this.loading = false;
          }
        }
        // Continue polling if payment not verified and under max polls
        return pollCount < maxPolls;
      }, true)
    ).subscribe({
      error: (err) => {
        console.error('Error loading order details:', err);
        this.loading = false;
        this.pollingSubscription.unsubscribe();
      }
    });
  }

  private startRedirectCountdown() {
    this.showRedirectMessage = true;

    this.countdownSubscription = interval(1000).subscribe(() => {
      this.redirectCountdown--;

      if (this.redirectCountdown <= 0) {
        // Time's up - redirect to order details
        this.goToOrderDetails();
        this.countdownSubscription.unsubscribe();
      }
    });
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


  goToOrderDetails() {
    if (this.orderId) {
      this.router.navigate(['/account/order/details', this.orderId]);
    }
  }

  goToHome() {
    this.router.navigate(['/']);
  }

  continueShopping() {
    this.router.navigate(['/collections']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
  }
}