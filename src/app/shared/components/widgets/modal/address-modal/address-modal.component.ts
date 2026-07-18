import { ChangeDetectorRef, Component, NgZone, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalDismissReasons, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { debounceTime, distinctUntilChanged, map, Observable, take } from 'rxjs';
import { Select2Data, Select2UpdateEvent } from 'ng-select2-component';
import { CreateAddress, UpdateAddress } from '../../../../action/account.action';
import { CountryState } from '../../../../state/country.state';
import { StateState } from '../../../../state/state.state';
import { AuthState } from '../../../../state/auth.state';
import { UserAddress } from '../../../../interface/user.interface';
import * as data from '../../../../data/country-code';
import { Country, State, City } from 'country-state-city';
import { AuthService } from '../../../../services/auth.service';
import { NotificationService } from '../../../../services/notification.service';
import { get } from 'http';
import { state } from '@angular/animations';

@Component({
  selector: 'address-modal',
  templateUrl: './address-modal.component.html',
  styleUrls: ['./address-modal.component.scss']
})
export class AddressModalComponent {

  public form: FormGroup;
  public closeResult: string;
  public modalOpen: boolean = false;

  public states$: Observable<Select2Data>;
  public city$: Observable<Select2Data>;
  public cityOptions: Select2Data = [];
  public address: UserAddress | null;
  public codes = data.countryCodes;

  public stateNameData: any = [];
  public regionNameData: any = [];
  public circleNameData: any = [];
  public officeNameData: any = []; // Area Name
  public divisionNameData: any = [];
  public cityNameData: any = []; // District Name

  @ViewChild("addressModal", { static: false }) AddressModal: TemplateRef<string>;
  @Select(CountryState.countries) countries$: Observable<Select2Data>;
  @Select(AuthState.accessToken) accessToken$: Observable<string>;

  public selectedPinCode = '';
  public filterPinCodeAreas: any;
  public checkIfPinCodeExists = true;

  private stateToDistricts: Map<string, Set<string>> = new Map();
  private districtToOffices: Map<string, any[]> = new Map();
  private pincodeToOffice: Map<string, any> = new Map();

  constructor(
    private modalService: NgbModal,
    private store: Store,
    private formBuilder: FormBuilder,
    private cdRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private authService: AuthService,
    private notificationService: NotificationService

  ) {
    this.form = this.formBuilder.group({
      title: new FormControl('', [Validators.required, Validators.pattern(/^[A-Za-z\s]*$/)]),
      floor_no: new FormControl(''),
      flat_no: new FormControl(''),
      building: new FormControl(''),
      road: new FormControl(''),
      street: new FormControl('', [Validators.required]),
      state_id: new FormControl('', [Validators.required]),
      country_id: new FormControl('', [Validators.required]),
      city: new FormControl('', [Validators.required]),
      area: new FormControl('', [Validators.required]),
      pincode: new FormControl('', [Validators.required]),
      country_code: new FormControl('91', [Validators.required]),
      phone: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]*$/)])
    })

    this.form.controls['phone']?.valueChanges.subscribe((value) => {
      if (value && value.toString().length > 10) {
        this.form.controls['phone']?.setValue(+value.toString().slice(0, 10));
      }
    });

    const localUserCheck = JSON.parse(localStorage.getItem('account') || '');
    if (localUserCheck?.user?.access_token) {

    }
    this.downloadPINAreaExcelJSON();

    this.form.controls['pincode']?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe((value) => {
        if (value && value.toString().length > 5) {
          const currentAreaOffice = this.officeNameData.find((dataz: any) => dataz.OfficeName == this.form.controls['area'].value);
          if (!currentAreaOffice || currentAreaOffice.Pincode != value) {
            this.checkIfPinCodeExists = false;
            const matchedOffice = this.pincodeToOffice.get(String(value));
            if (matchedOffice) {
              this.filterPinCodeAreas = [matchedOffice];

              // City Options (districts in the matched state)
              const districts = this.stateToDistricts.get(matchedOffice.StateName);
              this.cityOptions = districts
                ? [...districts].sort().map((district: string) => ({
                    label: district,
                    value: district,
                    District: district,
                  }))
                : [];

              // Area Data (offices in the matched district)
              const offices = this.districtToOffices.get(matchedOffice.District?.toLowerCase()) || [];
              if (offices.length) {
                this.officeNameData = offices.map((dataz: any) => ({
                  label: dataz.OfficeName,
                  value: dataz.OfficeName,
                  OfficeName: dataz.OfficeName,
                  Pincode: dataz.Pincode,
                }));
              } else {
                this.officeNameData = [{
                  label: 'Other',
                  value: 'Other',
                  pinCode: ''
                }];
              }

              this.form.controls['state_id'].setValue(matchedOffice.StateName);
              setTimeout(() => {
                this.form.controls['city'].setValue(matchedOffice.District);
                this.form.controls['area'].setValue(this.officeNameData.length ? this.officeNameData[0].label : '');
                this.checkIfPinCodeExists = true;
              }, 500);
            } else {
              this.filterPinCodeAreas = [];
              this.checkIfPinCodeExists = true;
              this.form.controls['pincode'].markAsTouched();
              this.form.controls['pincode'].setErrors({ required: true });
              this.notificationService.showError('Invalid Pincode');
            }
          } else {
            this.checkIfPinCodeExists = true;
            this.selectedPinCode = value;
          }
        }
      });

    setTimeout(() => {
      this.form.controls['country_id'].disable();
      this.form.controls['area'].disable();
      this.form.controls['pincode'].disable();
      this.form.controls['country_code'].disable();
    }, 500);

  }

  capitalizeFirstLetter(val: string) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
  }

  downloadPINAreaExcelJSON() {
    // Check if user is logged in
    this.accessToken$.pipe(take(1)).subscribe(token => {
      const apiCall = token
        ? this.authService.fetchAreaPINCodeJSON()
        : this.authService.fetchAreaPINCodeJSONWithoutLogin();

      apiCall.subscribe({
        next: (res) => {
          if (res && res['data']) {
            this.ngZone.runOutsideAngular(() => {
              this.buildPinCodeIndexes(res['data']);
              this.ngZone.run(() => this.cdRef.detectChanges());
            });
          } else {
            this.fallbackToWithoutLogin();
          }
        },
        error: (err) => {
          console.error("Failed to load address data, trying fallback:", err);
          this.fallbackToWithoutLogin();
        }
      });
    });
  }

  fallbackToWithoutLogin() {
    this.authService.fetchAreaPINCodeJSONWithoutLogin().subscribe({
      next: (res) => {
        if (res && res['data']) {
          this.ngZone.runOutsideAngular(() => {
            this.buildPinCodeIndexes(res['data']);
            this.ngZone.run(() => this.cdRef.detectChanges());
          });
        } else {
          this.notificationService.showError('Failed to fetch Pincode and Area data');
        }
      },
      error: (err) => {
        console.error("Fallback also failed:", err);
        this.notificationService.showError('Failed to fetch Pincode and Area data');
      }
    });
  }

  private buildPinCodeIndexes(records: any[]) {
    const stateSet = new Set<string>();
    this.stateToDistricts = new Map();
    this.districtToOffices = new Map();
    this.pincodeToOffice = new Map();

    for (const item of records) {
      const state = item?.StateName;
      const district = item?.District;
      const officeName = item?.OfficeName;
      const pincode = item?.Pincode != null ? String(item.Pincode) : '';

      if (state) stateSet.add(state);

      if (state && district) {
        let districts = this.stateToDistricts.get(state);
        if (!districts) {
          districts = new Set<string>();
          this.stateToDistricts.set(state, districts);
        }
        districts.add(district);
      }

      if (district) {
        const key = district.toLowerCase();
        let offices = this.districtToOffices.get(key);
        if (!offices) {
          offices = [];
          this.districtToOffices.set(key, offices);
        }
        offices.push({ OfficeName: officeName, Pincode: pincode });
      }

      if (pincode) {
        this.pincodeToOffice.set(pincode, {
          StateName: state,
          District: district,
          OfficeName: officeName,
        });
      }
    }

    this.stateNameData = [...stateSet].sort().map((s: string) => ({
      label: s,
      value: s
    }));
  }

  validatePinCode(payload: any) {
    this.authService.validatePinCode(payload).subscribe({
      next: (res) => {
        if (res.status) {
          this.form.controls['pincode'].setErrors(null);
        } else {
          this.form.controls['pincode'].markAsTouched();
          this.form.controls['pincode'].setErrors({ required: true });
          this.notificationService.showError(res.msg);
        }
      }
    });
  }

  countryChange(data: Select2UpdateEvent) {
    if (data && data?.value) {
      // this.states$ = this.store
      //     .select(StateState.states)
      //     .pipe(map(filterFn => filterFn(+data?.value)));
      // if(!this.address)
      //   this.form.controls['state_id'].setValue('');
    } else {
      this.form.controls['state_id'].setValue('');
    }
  }

  stateChange(data: Select2UpdateEvent) {
    if (data && data?.value && this.checkIfPinCodeExists) {
      this.form.controls['city'].setValue('');
      this.form.controls['area'].setValue('');
      this.form.controls['pincode'].setValue('');
      const selectedState = data.options[0].label;
      const districts = this.stateToDistricts.get(selectedState);

      this.cityOptions = districts
        ? [...districts].sort().map((district: string) => ({
            label: district,
            value: district,
            District: district,
          }))
        : [];
    }
  }

  cityChange(data: Select2UpdateEvent) {
    if (data && data?.value && this.checkIfPinCodeExists) {
      this.form.controls['area'].setValue('');
      this.form.controls['pincode'].setValue('');
      const offices = this.districtToOffices.get(data.value?.toString().toLowerCase()) || [];
      if (offices.length) {
        this.officeNameData = offices.map((dataz: any) => ({
          label: dataz.OfficeName,
          value: dataz.OfficeName,
          OfficeName: dataz.OfficeName,
          Pincode: dataz.Pincode,
        }));
      } else {
        this.officeNameData = [{
          label: 'Other',
          value: 'Other',
          pinCode: ''
        }];
      }
      this.form.controls['area'].enable();
    }
  }

  areaChange(data: Select2UpdateEvent) {
    if (data && data?.value && this.checkIfPinCodeExists) {
      this.form.controls['pincode'].enable();
      const filterPinCode = this.officeNameData.filter((dataz: any) => dataz.label == data.value);
      this.form.controls['pincode'].setValue(filterPinCode.length ? filterPinCode[0].Pincode : '');
    }
  }

  async openModal(value?: UserAddress) {
    this.modalOpen = true;
    this.patchForm(value);
    this.modalService.open(this.AddressModal, {
      ariaLabelledBy: 'address-add-Modal',
      centered: true,
      windowClass: 'theme-modal modal-lg address-modal'
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

  patchForm(value?: UserAddress) {
    if (value) {
      this.address = value;
      this.form.patchValue({
        user_id: value?.user_id,
        title: value?.title,
        floor_no: value?.floor_no,
        flat_no: value?.flat_no,
        building: value?.building,
        road: value?.road,
        street: value?.street,
        country_id: value?.country_id,
        state_id: value?.state_id,
        city: value?.city,
        pincode: value?.pincode,
        area: value?.area,
        country_code: value?.country_code,
        phone: value?.phone
      });
      setTimeout(() => this.form.controls['country_code'].setValue('91'), 300);
      setTimeout(() => this.form.controls['state_id'].setValue(value?.state_id), 400);
      setTimeout(() => this.form.controls['city'].setValue(value?.city), 600);
      setTimeout(() => this.form.controls['area'].setValue(value?.area), 800);
    } else {
      this.address = null;
      this.form.reset();
      this.form?.controls?.['country_code'].setValue('91');
    }
  }

  submit() {

    this.form.markAllAsTouched();
    this.form.value['country_id'] = 'INDIA';
    let action = new CreateAddress(this.form.value);

    if (this.address) {
      action = new UpdateAddress(this.form.value, this.address.id);
    }
    if (this.form.valid) {
      this.store.dispatch(action).subscribe({
        complete: () => {
          this.form.reset();
          if (!this.address) {
            this.form?.controls?.['country_code'].setValue('91');
          }
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.modalOpen) {
      this.modalService.dismissAll();
    }
  }

  // Input restrictions
  allowOnlyLetters(event: KeyboardEvent): void {
    const allowedControlKeys = [
      'Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
    ];
    if (allowedControlKeys.includes(event.key)) return;
    if (!/^[A-Za-z\s]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanitizeLettersInput(event: Event, controlName: 'title'): void {
    const input = event.target as HTMLInputElement;
    const sanitized = (input.value || '').replace(/[^A-Za-z\s]/g, '');
    if (sanitized !== input.value) {
      input.value = sanitized;
      this.form.controls[controlName].setValue(sanitized, { emitEvent: false });
    }
  }

  sanitizeLettersPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (/[^A-Za-z\s]/.test(pasted)) {
      event.preventDefault();
      const sanitized = pasted.replace(/[^A-Za-z\s]/g, '');
      document.execCommand('insertText', false, sanitized);
    }
  }

  allowOnlyDigits(event: KeyboardEvent): void {
    const allowedControlKeys = [
      'Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
    ];
    if (allowedControlKeys.includes(event.key)) return;
    if (event.ctrlKey || event.metaKey) return;
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanitizeDigitsInput(event: Event, controlName: 'phone'): void {
    const input = event.target as HTMLInputElement;
    const digitsOnly = (input.value || '').replace(/\D/g, '').slice(0, 10);
    if (digitsOnly !== input.value) {
      input.value = digitsOnly;
      this.form.controls[controlName].setValue(digitsOnly, { emitEvent: false });
    }
  }

  sanitizeDigitsPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (/\D/.test(pasted)) {
      event.preventDefault();
      const sanitized = pasted.replace(/\D/g, '').slice(0, 10);
      document.execCommand('insertText', false, sanitized);
    }
  }

}
