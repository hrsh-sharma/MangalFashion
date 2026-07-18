import { Injectable } from "@angular/core";
import { Action, Selector, State, StateContext } from "@ngxs/store";
import { tap } from "rxjs";
import { SettingService } from "../services/setting.service";
import { GetSettingOption, SelectedCurrency } from "../action/setting.action";
import { Values } from "../interface/setting.interface";
import { Currency } from "../interface/currency.interface";
import { icons } from "feather-icons";

export class SettingStateModel {
  setting: Values | null;
  selectedCurrency: Currency | null;
}

@State<SettingStateModel>({
  name: "setting",
  defaults: {
    setting: null,
    selectedCurrency: null
  }
})
@Injectable()
export class SettingState {

  constructor(private settingService: SettingService) {}

  @Selector()
  static setting(state: SettingStateModel) {
    return state.setting;
  }

  @Selector()
  static selectedCurrency(state: SettingStateModel) {
    return state.selectedCurrency;
  }

  @Action(GetSettingOption)
  getSettingOptions(ctx: StateContext<SettingStateModel>) { 
    return this.settingService.getSettingOption().pipe(
      tap({
        next: (result) => {
          let customValue;
          const state = ctx.getState();
         
          if(!state.selectedCurrency && result?.values?.general){
            state.selectedCurrency = result?.values?.general.default_currency;
          }

          if(result.values?.payment_methods?.length) {
            customValue = JSON.parse(JSON.stringify(result.values));
            const customPayments = [
              
              {
                name: 'cashfree',
                status: false,
                title: 'Cashfree',
                icon: './assets/images/cash_free.jpg',
              },
              {
                name: 'mangal fashion_nabu',
                status: false,
                title: 'Pay By UPI INTENT 3',
                // icon: './assets/images/payment/mangal fashion_nabu.png',
              },
              {
                name: 'cash_free',
                status: false,
                title: 'Cash Free',
                icon: './assets/images/cash_free.jpg',
              },
              {
                name: 'zyaada_pay',
                status: false,
                title: 'Zyaada Pay',
                icon: './assets/images/zyaada_pay_logo.jpg',
              },
              {
                name: 'sub_paisa',
                status: false,
                title: 'Sab Paisa',
                icon: './assets/images/sub_paisa.png'
              },
              {
                name: 'ease_buzz',
                status: false,
                title: 'Ease Buzz',
                icon: './assets/images/easebuzz.png'
              },
              {
                name: 'neoKred2',
                status: false,
                title: 'Pay By UPI INTENT2',
                // icon: './assets/images/payment/pay_by_qr.png',
              },
              {
                name: 'star_mangal',
                status: false,
                title: 'Pay via UPI App',
                // icon: './assets/images/payment/star_mangal.png',
              },
              {
                name: 'pay_drill',
                status: true,
                title: 'Cash Free',
                icon: './assets/images/cash_free.jpg',
              },
              {
                name: 'payrise_mangalfashion_jio',
                status: true,
                title: 'Pay by UPI/QR',
                icon: '/assets/images/jio-pay1.png',
              },
            ];
            customValue.payment_methods = customPayments //[result.values.payment_methods[0]];
          }
          ctx.patchState({
          ...state,
          setting: customValue,
          });
        },
        error: (err) => {
          throw new Error(err?.error?.message);
        },
      })
    );
  }

  @Action(SelectedCurrency)
  selectedCurrency(ctx: StateContext<SettingStateModel>, action: SelectedCurrency){
    const state = ctx.getState();
    ctx.patchState({
      ...state,
      selectedCurrency: action.payload
    });
  }
  
}
