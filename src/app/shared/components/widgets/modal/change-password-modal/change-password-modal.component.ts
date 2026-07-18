import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalDismissReasons, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { UpdateUserPassword } from '../../../../action/account.action';
import { CustomValidators } from '../../../../validator/password-match';

@Component({
  selector: 'app-change-password-modal',
  templateUrl: './change-password-modal.component.html',
  styleUrls: ['./change-password-modal.component.scss']
})
export class ChangePasswordModalComponent {

  public form: FormGroup;
  public closeResult: string;

  public modalOpen: boolean = false;

  @ViewChild("passwordModal", { static: false }) PasswordModal: TemplateRef<string>;
  
  constructor(private modalService: NgbModal,
    private store: Store,
    private formBuilder: FormBuilder) {
      this.form = this.formBuilder.group({
        current_password: new FormControl('', [Validators.required]),
        password: new FormControl('', [Validators.required]),
        password_confirmation: new FormControl('', [Validators.required])
      },{validator : CustomValidators.MatchValidator('password', 'password_confirmation')})
  }

  async openModal() {
    this.modalOpen = true;
    this.modalService.open(this.PasswordModal, {
      ariaLabelledBy: 'password-Modal',
      centered: true,
      windowClass: 'theme-modal'
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

  get passwordMatchError() {
    return (
      this.form?.getError('mismatch') &&
      this.form?.get('password_confirmation')?.touched
    );
  }

  togglePasswordVisibility(fieldId: string) {
    const input = document.getElementById(fieldId) as HTMLInputElement;
    const icon = input?.nextElementSibling as HTMLElement;
    if (input && icon) {
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('ri-eye-off-line');
        icon.classList.add('ri-eye-line');
      } else {
        input.type = 'password';
        icon.classList.remove('ri-eye-line');
        icon.classList.add('ri-eye-off-line');
      }
    }
  }

  submit(){
    this.form.markAllAsTouched();
    if(this.form.valid) {
      this.store.dispatch(new UpdateUserPassword(this.form.value)).subscribe({
        complete: () => {
          this.form.reset();
        }
      });
    }
  }

  ngOnDestroy() {
    if(this.modalOpen) {
      this.modalService.dismissAll();
    }
  }

}
