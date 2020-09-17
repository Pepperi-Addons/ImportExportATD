import { Injectable } from "@angular/core";
import jwt from "jwt-decode";

//@ts-ignore
import { AddonService } from "pepperi-addon-service";
//@ts-ignore
import { PepperiDataConverterService } from "pepperi-data-converter";

@Injectable({
  providedIn: "root",
})
export class PluginService {
  constructor(
    private addonService: AddonService,
    public pepperiDataConverter: PepperiDataConverterService
  ) {}

  getTypes(successFunc = null, errorFunc = null) {
    let types: KeyValuePair<string>[] = [];
    this.addonService.httpGetApiCall(
      "/meta_data/activities/types",
      (activityTypes) => {
        if (activityTypes) {
          activityTypes.forEach((type) =>
            types.push({ Key: type.TypeID, Value: type.ExternalID })
          );
          console.log("plugin:" + activityTypes);
        }
        this.addonService.httpGetApiCall(
          "/meta_data/transactions/types",
          (transactionTypes) => {
            if (transactionTypes) {
              transactionTypes.forEach((type) =>
                types.push({ Key: type.TypeID, Value: type.ExternalID })
              );
            }
            successFunc(types);
          },
          errorFunc
        );
      },
      errorFunc
    );
  }
}

export interface KeyValuePair<T> {
  Key: string;
  Value: T;
}
