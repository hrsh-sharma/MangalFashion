import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckoutPayload, Order, OrderModel, OrderCheckout, PlaceOrder, RePaymentPayload } from '../interface/order.interface';
import { Params } from '../interface/core.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  public skeletonLoader: boolean = false;

  constructor(private http: HttpClient) {}

  getOrders(payload?: Params): Observable<OrderModel> {
    return this.http.get<OrderModel>(`${environment.URL}/order`, { params: payload });
  }

  viewOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${environment.URL}/order/${id}`);
  }

  checkout(payload: CheckoutPayload): Observable<OrderCheckout> {
    return this.http.post<OrderCheckout>(`${environment.URL}/checkout`, payload);
  }

  placeOrder(payload: CheckoutPayload): Observable<PlaceOrder> {
    return this.http.post<PlaceOrder>(`${environment.URL}/order`, payload);
  }

  rePayment(payload: RePaymentPayload): Observable<PlaceOrder> {
    // Validate payload before sending
    if (!payload.payment_method || !payload.order_number) {
      console.error('rePayment: Invalid payload - missing required fields', payload);
      throw new Error('Payment method and order number are required');
    }
    console.log('rePayment: Sending payload to backend', {
      url: `${environment.URL}/rePayment`,
      payload: payload
    });
    return this.http.post<PlaceOrder>(`${environment.URL}/rePayment`, payload);
  }

  orderTracking(payload: { order_number: string, email_or_phone: string }): Observable<Order> {
    return this.http.get<Order>(`${environment.URL}/trackOrder`, { params: payload });
  }

  downloadInvoice(payload?: Params): Observable<Blob> {
    const requestBody = {}; // You can provide any necessary request body here
    return this.http.post<Blob>(`${environment.URL}/order/invoice`, payload , {
      responseType: 'blob' as 'json'
    });
  }

  checkPaymentStatus(orderNumber: string, paymentMethod: string): Observable<any> {
    if (paymentMethod === 'payrise_mangalfashion_jio' || paymentMethod === 'mangalfashion_jio') {
      // For Jio UPI, status check is handled via polling the View Order API
      return this.http.get<any>(`${environment.URL}/order/${orderNumber}`);
    }
    
    return this.http.get<any>(`${environment.URL}/check-payment-status`, { 
      params: { order_number: orderNumber, payment_method: paymentMethod }
    });
  }

}
