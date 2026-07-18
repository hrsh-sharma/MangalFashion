import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-contact-us',
  standalone: true,
  templateUrl: './contact-us.component.html',
  styleUrls: ['./contact-us.component.scss'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class ContactUsComponent {
  contactForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern('^[A-Za-z ]+$')]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      message: ['', Validators.required]
    });
  }

  filterSpecialCharacters(event: any, fieldName: string) {
    const input = event.target;
    const value = input.value;
    // Allow only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.contactForm.get(fieldName)?.setValue(filteredValue);
    }
  }

  filterEmailCharacters(event: any) {
    const input = event.target;
    const value = input.value;
    // Allow only email-allowed characters: letters, numbers, dot, underscore, hyphen, plus, @
    const filteredValue = value.replace(/[^a-zA-Z0-9._\-+@]/g, '');
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.contactForm.get('email')?.setValue(filteredValue);
    }
  }

  filterPhoneNumber(event: any) {
    const input = event.target;
    const value = input.value;
    // Allow only digits and limit to 10 characters
    const filteredValue = value.replace(/\D/g, '').slice(0, 10);
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.contactForm.get('phone')?.setValue(filteredValue);
    }
  }

  onSubmit() {
    if (this.contactForm.valid) {
      console.log('Form submitted', this.contactForm.value);
      alert('Form submitted successfully!');
      this.contactForm.reset();
    } else {
      alert('Please fill all fields correctly before submitting.');
    }
  }
}
