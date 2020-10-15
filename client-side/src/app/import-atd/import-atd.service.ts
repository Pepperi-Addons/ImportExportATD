import { Injectable, Type } from "@angular/core";
//@ts-ignore
import { AddonService } from "pepperi-addon-service";
// @ts-ignore
import { MatDialog } from "@angular/material";
import { Reference } from "./../../../../models/reference";
import { ActivityTypeDefinition } from "./../../../../models/activityTypeDefinition";
import { ReferenceData } from "./../../../../models/referenceData";
import { ReferencesMap, Pair } from "./../../../../models/referencesMap";
import { PapiClient } from "@pepperi-addons/papi-sdk";
import jwt from "jwt-decode";
import { ignoreElements } from "rxjs/operators";
import { KeyValuePair } from "../../../../models/keyValuePair";
import { ReferenceType } from "../../../../models/referenceType";

@Injectable({
  providedIn: "root",
})
export class ImportAtdService {
  [x: string]: any;

  file: File;
  accessToken = "";
  parsedToken: any;
  papiBaseURL = "";
  pluginUUID = `e9029d7f-af32-4b0e-a513-8d9ced6f8186`;
  exportedAtdstring: string;
  exportedAtd: ActivityTypeDefinition;

  constructor(private addonService: AddonService, public dialog: MatDialog) {
    const accessToken = this.addonService.getUserToken();
    this.parsedToken = jwt(accessToken);
    this.papiBaseURL = this.parsedToken["pepperi.baseurl"];
    //this.papiClient = PapiClient;
  }

  //   openDialog(
  //     title = "Modal Test",
  //     content,
  //     buttons,
  //     input,
  //     callbackFunc,
  //     panelClass = "pepperi-modalbox"
  //   ): void {
  //     const self = this;
  //     const dialogConfig = new MatDialogConfig();
  //     // const data = new DialogModel(
  //     //   title,
  //     //   content,
  //     //   DialogDataType.Component,
  //     //   [],
  //     //   input
  //     // );
  //     // dialogConfig.disableClose = true;
  //     // dialogConfig.autoFocus = false;
  //     // dialogConfig.data = data;
  //     // dialogConfig.panelClass = "pepperi-standalone";
  //     // const dialogRef = this.dialog.open(content, dialogConfig);
  //     // dialogRef.afterClosed().subscribe((res) => {
  //     //   callbackFunc(res);
  //     // });
  //   }

  //   openTextDialog(title, content, buttons) {
  //     const data = new DialogData(title, content, DialogDataType.Text, buttons);
  //     this.userService.openDialog(data);
  //   }
  uploadFile(file) {
    let formData: FormData = new FormData();
    formData.append("file", file, file.name);
    console.log(`formData:${formData}`);
    this.file = file;

    //this.http.post(url, formData, request_options)
  }

  async buildReferencesMap(): Promise<ReferencesMap> {
    let referencesMap = {} as ReferencesMap;
    referencesMap.Pairs = [];
    console.log(`in buildReferencesMap`);
    this.exportedAtd = JSON.parse(this.exportedAtdstring);
    let exportReferences = this.exportedAtd.References;

    let referencesData: ReferenceData = await this.GetReferencesData(
      exportReferences
    );

    exportReferences.forEach((ref) => {
      if (ref.Type !== ReferenceType.Webhook) {
        let referencesDataList = [];
        referencesDataList = referencesData[ReferenceType.toString(ref.Type)];
        let referenceDataIdIndex = referencesDataList.findIndex(
          (data) => data.InternalID && data.InternalID.toString() === ref.ID
        );
        if (ref.Type === ReferenceType.GenericList) {
          referenceDataIdIndex = referencesDataList.findIndex(
            (data) => data.ID && data.ID.toString() === ref.UUID
          );
        }
        if (referenceDataIdIndex > -1) {
          this.addReferencesPair(
            referencesDataList[referenceDataIdIndex],
            ref,
            referencesMap
          );
        }
      }
    });
    let referencesDataList = [];
    exportReferences.forEach((ref) => {
      let refIndex = referencesMap.Pairs.findIndex(
        (pair) => pair.destinition && pair.destinition.ID === ref.ID
      );
      // if nof found object with same ID searh by name\externalid
      if (refIndex == -1) {
        referencesDataList = referencesData[ReferenceType.toString(ref.Type)];

        switch (ref.Type) {
          case ReferenceType.Filter:
          case ReferenceType.Profile:
          case ReferenceType.ActivityTypeDefinition:
          case ReferenceType.GenericList:
            let referenceDataNameIndex = referencesDataList.findIndex(
              (data) => data.Name && data.Name.toString() === ref.Name
            );
            if (referenceDataNameIndex > -1) {
              this.addReferencesPair(
                referencesDataList[referenceDataNameIndex],
                ref,
                referencesMap
              );
            } else {
              let pair = {} as Pair;
              pair.origin = ref;
              pair.destinition = null;
              referencesMap.Pairs.push(pair);
            }
            //referencesDataList = referencesData.udts;
            break;
          case ReferenceType.CustomizationFile:
            let referenceDataFileNameIndex = referencesDataList.findIndex(
              (data) => data.Title && data.Title.toString() === ref.Name
            );
            if (referenceDataFileNameIndex > -1) {
              this.addReferencesPair(
                referencesDataList[referenceDataFileNameIndex],
                ref,
                referencesMap
              );
            } else {
              let pair = {} as Pair;
              pair.origin = ref;
              pair.destinition = null;
              referencesMap.Pairs.push(pair);
            }
            break;
          case ReferenceType.Catalog:
            let referenceDataExternalIDIndex = referencesDataList.findIndex(
              (data) =>
                data.ExternalID && data.ExternalID.toString() === ref.Name
            );
            if (referenceDataExternalIDIndex > -1) {
              this.addReferencesPair(
                referencesDataList[referenceDataExternalIDIndex],
                ref,
                referencesMap
              );
            } else {
              let pair = {} as Pair;
              pair.origin = ref;
              pair.destinition = null;
              referencesMap.Pairs.push(pair);
            }
            break;
          case ReferenceType.UserDefinedTable:
            let referenceDataTableIDIndex = referencesDataList.findIndex(
              (data) => data.TableID && data.TableID.toString() === ref.Name
            );
            if (referenceDataTableIDIndex > -1) {
              this.addReferencesPair(
                referencesDataList[referenceDataTableIDIndex],
                ref,
                referencesMap
              );
            } else {
              let pair = {} as Pair;
              pair.origin = ref;
              pair.destinition = null;
              referencesMap.Pairs.push(pair);
            }
            break;
        }
      }
    });
    //    else if (
    //     ref.Type === ReferenceType.GenericList
    //   ) {
    //     switch (ref.Type) {
    //       case ReferenceType.UserDefinedTable:
    //         referencesDataList = referencesData.udts;

    //         let referenceDataIDIndedx = referencesDataList.findIndex(
    //           (data) => data.InternalID && data.InternalID.toString() === ref.ID
    //         );
    //         let referenceFileNameIndedx = referencesDataList.findIndex(
    //           (data) => data.FileName && data.FileName.toString() === ref.Name
    //         );
    //         let referenceFileTableIdIndedx = referencesDataList.findIndex(
    //           (data) => data.TableID && data.TableID.toString() === ref.ID
    //         );
    //         if (referenceDataIDIndedx > -1) {
    //           this.addReferencesPair(
    //             referencesData[referenceDataIDIndedx],
    //             ref,
    //             referencesMap
    //           );
    //         }
    //         if (referenceFileNameIndedx > -1) {
    //           this.addReferencesPair(
    //             referencesData[referenceFileNameIndedx],
    //             ref,
    //             referencesMap
    //           );
    //         }
    //         if (referenceFileTableIdIndedx > -1) {
    //           this.addReferencesPair(
    //             referencesData[referenceFileTableIdIndedx],
    //             ref,
    //             referencesMap
    //           );
    //         }
    //         break;

    //       case ReferenceType.Filter:
    //         let referenceDataFileNameIndex = referencesDataList.findIndex(
    //           (data) => data.FileName && data.FileName.toString() === ref.Name
    //         );
    //         let referenceDataIDIndex = referencesDataList.findIndex(
    //           (data) => data.InternalID && data.InternalID.toString() === ref.ID
    //         );
    //         let referenceDataTableIDIndex = referencesDataList.findIndex(
    //           (data) => data.TableID && data.TableID.toString() === ref.ID
    //         );
    //         referencesDataList = referencesData.filters;
    //         if (
    //           referenceDataFileNameIndex > -1 ||
    //           referenceDataIDIndex > -1 ||
    //           referenceDataTableIDIndex > -1
    //         )
    //           this.addReferencesPair(
    //             referencesDataList[referenceDataFileNameIndex],
    //             ref,
    //             referencesMap
    //           );

    //         break;
    //     }
    //   }
    // });

    console.log("referencesData" + referencesData);
    console.log("referencesMap: " + referencesMap);

    referencesMap;
    return referencesMap;
  }

  private addReferencesPair(
    element: any,
    ref: Reference,
    referencesMap: ReferencesMap
  ) {
    console.log("at addReferencesPair");
    let destinitionRef = {} as Reference;

    destinitionRef.ID = element.InternalID.toString();
    destinitionRef.UUID = element.UUID;
    destinitionRef.Content = ref.Content;
    destinitionRef.Path = element.URL;
    destinitionRef.Type = ref.Type;

    if (element.ExternalID != undefined) {
      destinitionRef.Name = element.ExternalID;
    } else if (element.Title != undefined) {
      destinitionRef.Name = element.Title;
    } else if (element.TableID != undefined) {
      destinitionRef.Name = element.TableID;
    } else {
      destinitionRef.Name = element.Name;
    }

    let pair = {} as Pair;

    pair.origin = ref;
    pair.destinition = destinitionRef;
    referencesMap.Pairs.push(pair);
  }

  private async GetReferencesData(
    exportReferences: Reference[]
  ): Promise<ReferenceData> {
    let profileIndex = exportReferences.findIndex(
      (ref) => ref.Type === ReferenceType.Profile
    );
    let genericListIndex = exportReferences.findIndex(
      (ref) => ref.Type === ReferenceType.GenericList
    );
    let fileIndex = exportReferences.findIndex(
      (ref) => ref.Type === ReferenceType.CustomizationFile
    );
    let activityTypeDefinitionIndex = exportReferences.findIndex(
      (ref) => ref.Type === ReferenceType.ActivityTypeDefinition
    );
    let catalogIndex = exportReferences.findIndex(
      (ref) => ref.Type === ReferenceType.Catalog
    );
    let filterIndex = exportReferences.findIndex(
      (ref) => ref.Type === ReferenceType.Filter
    );
    let udtIndex = exportReferences.findIndex(
      (ref) => ref.Type === ReferenceType.UserDefinedTable
    );
    let referencesData = {} as ReferenceData;

    if (profileIndex > -1) {
      await this.getReferencesDataObject("/profiles").then(
        (res) => (referencesData.Profile = res)
      );
    }
    if (genericListIndex > -1) {
      await this.getReferencesMetaDataGenericList(`accounts`).then(
        (res) => (referencesData.GenericList = res)
      );
      await this.getReferencesMetaDataGenericList(
        `all_activities`
      ).then((res) => referencesData.GenericList.concat(res));
    }
    if (fileIndex > -1) {
      await this.getReferencesFiles().then(
        (res) => (referencesData.CustomizationFile = res)
      );
    }
    if (activityTypeDefinitionIndex > -1) {
      await this.getReferencesTypes().then(
        (res) => (referencesData.ActivityTypeDefinition = res)
      );
    }
    if (catalogIndex > -1) {
      await this.getReferencesDataObject("Catalogs").then(
        (res) => (referencesData.Catalog = res)
      );
    }
    if (filterIndex > -1) {
      await this.getReferencesMetaDataObject("filters").then(
        (res) => (referencesData.Filter = res)
      );
    }
    if (udtIndex > -1) {
      await this.getUDTs().then(
        (res) => (referencesData.UserDefinedTable = res)
      );
    }
    return referencesData;
  }

  async getReferencesDataObject(type: string) {
    return await this.papiClient.get(`/${type}`);
  }

  async getReferencesFiles() {
    return await this.papiClient.fileStorage.iter().toArray();
  }
  async getReferencesTypes() {
    return await this.papiClient.types.iter().toArray();
  }
  //async getReferencesCatalogs() {
  //return await this.papiClient.
  //}
  async getUDTs() {
    return await this.papiClient.metaData.userDefinedTables.iter().toArray();
  }
  async getReferencesMetaDataObject(type: string) {
    return await this.papiClient.get(`/meta_data/${type}`);
  }
  async getReferencesMetaDataGenericList(type: string) {
    return await this.papiClient.get(`/meta_data/${type}/data_views`);
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
