import { Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { VerifyEmailOtp, VerifyNumberOTP, VerifyRegistrationOtp } from '../../../shared/action/auth.action';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { AuthNumberLoginState } from '../../../shared/interface/auth.interface';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.component.html',
  styleUrls: ['./otp.component.scss'],
})
export class OtpComponent {

  @ViewChildren('otpBox') otpBoxes: QueryList<ElementRef<HTMLInputElement>>;

  public digits: string[] = [];

  // OTP length depends on the flow: registration uses a 6-digit OTP,
  // all other flows (forgot-password / email, number login) use 5 digits.
  get otpLength(): number {
    return this.otpType === 'register' ? 6 : 5;
  }
  public otpError: boolean = false;
  public otpSubmitted: boolean = false;

  public email: string;
  public otpType: any;
  public number: AuthNumberLoginState;

  public breadcrumb: Breadcrumb = {
    title: "OTP",
    items: [{ label: 'OTP', active: true }]
  }

  constructor(
    public router: Router,
    public store: Store,
    public authService: AuthService
  ) {}

  ngOnInit(){
    this.otpType = this.authService.otpType;
    this.digits = new Array(this.otpLength).fill('');
    if(this.otpType === 'email'){
      this.email = this.store.selectSnapshot(state => state.auth.email);
      if(!this.email){
        this.router.navigateByUrl('/auth/login');
      }
    } else if(this.otpType === 'number'){
      this.number = this.store.selectSnapshot(state => state.auth.number);
      if(!this.number.phone){
        this.router.navigateByUrl('/auth/login');
      }
    } else if(this.otpType === 'register'){
      this.email = this.store.selectSnapshot(state => state.auth.email);
      if(!this.email){
        this.router.navigateByUrl('/auth/register');
      }
    } else {
      this.router.navigateByUrl('/auth/login');
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^0-9]/g, '');
    const digit = val ? val[val.length - 1] : '';

    this.digits[index] = digit;
    input.value = digit; // normalize DOM immediately; [value] binding will confirm on next CD

    if (this.otpSubmitted) {
      this.otpError = this.digits.join('').length < this.otpLength;
    }

    if (digit && index < this.otpLength - 1) {
      // Use rAF so Angular's CD settles before moving focus — prevents Chrome from
      // firing a synthetic input event on the newly focused OTP box.
      requestAnimationFrame(() => {
        this.otpBoxes.toArray()[index + 1]?.nativeElement.focus();
      });

    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      if (this.digits[index]) {
        this.digits[index] = '';
        input.value = '';
      } else if (index > 0) {
        const boxes = this.otpBoxes.toArray();
        this.digits[index - 1] = '';
        const prev = boxes[index - 1].nativeElement;
        prev.value = '';
        prev.focus();
      }
      if (this.otpSubmitted) {
        this.otpError = this.digits.join('').length < this.otpLength;
      }
      return;
    }

    // Block non-numeric printable characters
    if (event.key.length === 1 && !/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '').slice(0, this.otpLength);
    for (let i = 0; i < this.otpLength; i++) {
      this.digits[i] = pasted[i] ?? '';
    }
    if (this.otpSubmitted) {
      this.otpError = this.digits.join('').length < this.otpLength;
    }
    // rAF so Angular's [value] binding updates the DOM before we move focus
    const focusIndex = Math.min(pasted.length, this.otpLength - 1);
    requestAnimationFrame(() => {
      this.otpBoxes.toArray()[focusIndex]?.nativeElement.focus();
    });
  }

  submit() {
    this.otpSubmitted = true;
    const otp = this.digits.join('');
    if (otp.length < this.otpLength) {
      this.otpError = true;
      return;
    }
    this.otpError = false;

    var action: any;

    if(this.otpType === 'email') {
      action = new VerifyEmailOtp({ email: this.email, token: otp });
    }

    if(this.otpType === 'register') {
      action = new VerifyRegistrationOtp({ email: this.email, otp: otp });
    }

    if(this.otpType === 'number') {
      action = new VerifyNumberOTP({
        phone: this.number.phone,
        country_code: this.number.country_code,
        token: otp
      });
    }

    this.store.dispatch(action).subscribe({
      complete: () => {
        if(this.otpType === 'email'){
          this.router.navigateByUrl('/auth/update-password');
        } else if(this.otpType === 'register'){
          this.router.navigateByUrl('/auth/login');
        } else {
          this.router.navigateByUrl('/account/dashboard');
        }
      }
    });
  }

  resendOtp() {
    this.digits = new Array(this.otpLength).fill('');
    this.otpError = false;
    this.otpSubmitted = false;
    if(this.otpType === 'register'){
      this.router.navigateByUrl('/auth/register');
    } else {
      this.router.navigateByUrl('/auth/login');
    }
  }

}
