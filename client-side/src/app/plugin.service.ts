import { Injectable } from '@angular/core';

//@ts-ignore
import {AddonService} from 'pepperi-addon-service';

@Injectable({
  providedIn: 'root'
})
export class PluginService {

  constructor(private addonService: AddonService) { }
  
  getTypes(successFunc = null, errorFunc = null){
    let types:KeyValuePair<string>[] = [];
    this.addonService.httpGetApiCall('/meta_data/activities/types', (activityTypes) => {
      if (activityTypes) {
        activityTypes.forEach(type =>
            types.push({ Key: type.TypeID, Value: type.ExternalID })
        );
        console.log("plugin:" +activityTypes );

      }
      this.addonService.httpGetApiCall('/meta_data/transactions/types', (transactionTypes) => {
        if (transactionTypes) {
          transactionTypes.forEach(type =>
              types.push({ Key: type.TypeID, Value: type.ExternalID })
          );
        }
        successFunc(types);
      }, errorFunc);
    }, errorFunc);
    
  }
}

export interface KeyValuePair<T> {
  Key: string;
  Value:T
}