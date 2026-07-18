import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngxs/store';
import { ContactUs } from '../../../shared/action/page.action';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { SeoService } from '../../../shared/services/seo.service';

@Component({
  selector: 'app-contact-us',
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.scss']
})
export class ContactUsComponent implements OnInit {

  public breadcrumb: Breadcrumb = {
    title: "Contact Us",
    items: [{ label: 'Contact Us', active: true }]
  }

  public form: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private store: Store,
    private seoService: SeoService
  ) {
    this.form = this.formBuilder.group({
      name: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl('', [Validators.required]),
      subject: new FormControl('', [Validators.required]),
      message: new FormControl('', [Validators.required]),
    });
  }

  ngOnInit() {
    // Set unique SEO data for Contact Us page
    this.seoService.setSEOData({
      title: 'Contact Mangal Fashion – We\'re Here to Help You 24/7',
      description: 'Get in touch with Mangal Fashion customer support. We\'re available 24/7 to help with orders, products, and any questions you may have.',
      keywords: 'contact us, customer support, help, mangal fashion contact, customer service',
      canonicalUrl: 'https://mangalfashion.com/Contact-Us',
      url: 'https://mangalfashion.com/Contact-Us',
      type: 'website',
      image: 'https://mangalfashion.com/assets/images/contact-us.jpg'
    });
  }

  filterSpecialCharacters(event: any, fieldName: string) {
    const input = event.target;
    const value = input.value;
    // Allow only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get(fieldName)?.setValue(filteredValue);
    }
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

  filterPhoneNumber(event: any) {
    const input = event.target;
    const value = input.value;
    // Allow only digits and limit to 10 characters
    const filteredValue = value.replace(/\D/g, '').slice(0, 10);
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('phone')?.setValue(filteredValue);
    }
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.valid) {
      this.store.dispatch(new ContactUs(this.form.value)).subscribe({
        complete: () => {
          this.form.reset();
        }
      });
    }
  }
}
