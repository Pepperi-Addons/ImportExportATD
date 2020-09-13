import { Injectable } from "@angular/core";
//@ts-ignore
import { AddonService } from "pepperi-addon-service";
import { PapiClient } from "@pepperi-addons/papi-sdk";
import jwt from "jwt-decode";

@Injectable({
  providedIn: "root",
})
export class ExportAtdService {
  accessToken = "";
  parsedToken: any;
  papiBaseURL = "";
  pluginUUID = `e9029d7f-af32-4b0e-a513-8d9ced6f8186`;

  constructor(private addonService: AddonService) {
    const accessToken = this.addonService.getUserToken();
    this.parsedToken = jwt(accessToken);
    this.papiBaseURL = this.parsedToken["pepperi.baseurl"];
    //this.papiClient = PapiClient;
  }

  getTypes(successFunc = null, errorFunc = null) {
    let types: KeyValuePair<string>[] = [];
    this.addonService.httpGetApiCall(
      "/meta_data/activities/types",
      (activityTypes) => {
        if (activityTypes) {
          activityTypes.forEach((type) =>
            types.push({ Key: type.TypeID, Value: type.ExternalID })
          );
        }
        this.addonService.httpGetApiCall(
          "/meta_data/transactions/types",
          (transactionTypes) => {
            if (transactionTypes) {
              transactionTypes.forEach((type) =>
                types.push({ Key: type.TypeID, Value: type.ExternalID })
              );
            }
            console.log("api-tester:" + transactionTypes);
            successFunc(types);
          },
          errorFunc
        );
      },
      errorFunc
    );
  }
  getPapiClient() {
    return this.papiClient;
  }
  get papiClient(): PapiClient {
    return new PapiClient({
      baseURL: this.papiBaseURL,
      token: this.addonService.getUserToken(),
      addonUUID: this.pluginUUID,
      suppressLogging: true,
    });
  }
}
export interface KeyValuePair<T> {
  Key: string;
  Value: T;
}
