import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class PaymentSuccessGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    // Check if user has payment data indicating they came from a payment process
    const cameFromPayment = sessionStorage.getItem('came_from_checkout_payment');
    const hasPaymentData = sessionStorage.getItem('payment_uuid') || localStorage.getItem('order_id');

    if (cameFromPayment || hasPaymentData) {
      return true;
    }

    // No payment data found, redirect to home
    this.router.navigate(['/']);
    return false;
  }
}