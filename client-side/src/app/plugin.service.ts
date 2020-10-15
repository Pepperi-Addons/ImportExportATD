import { Injectable } from "@angular/core";
import jwt from "jwt-decode";
//@ts-ignore
import { UserService } from "pepperi-user-service";
//@ts-ignore
import { AddonService } from "pepperi-addon-service";
//@ts-ignore
import { PepperiDataConverterService } from "pepperi-data-converter";
import { MatDialogConfig, MatDialog } from "@angular/material";
// @ts-ignore
import { DialogDataType, DialogData } from "pepperi-dialog";
import { KeyValuePair } from "../../../models/keyValuePair";
@Injectable({
  providedIn: "root",
})
export class PluginService {
  constructor(
    public addonService: AddonService,
    public userService: UserService,
    public dialog: MatDialog,
    public pepperiDataConverter: PepperiDataConverterService
  ) {
    const accessToken = this.addonService.getUserToken();
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
  openTextDialog(title, content, buttons) {
    const data = new DialogData(title, content, DialogDataType.Text, buttons);
    this.userService.openDialog(data);
  }
}
