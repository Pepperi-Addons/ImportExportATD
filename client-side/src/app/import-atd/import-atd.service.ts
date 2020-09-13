import { Injectable } from "@angular/core";
//@ts-ignore
import { AddonService } from "pepperi-addon-service";
import {
  ReferencesMap,
  Pair,
  ActivityTypeDefinition,
  Reference,
} from "./../../../../server-side/api";
import { PapiClient } from "@pepperi-addons/papi-sdk";
import jwt from "jwt-decode";

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

  constructor(private addonService: AddonService) {
    const accessToken = this.addonService.getUserToken();
    this.parsedToken = jwt(accessToken);
    this.papiBaseURL = this.parsedToken["pepperi.baseurl"];
    //this.papiClient = PapiClient;
  }

  uploadFile(file) {
    let formData: FormData = new FormData();
    formData.append("file", file, file.name);
    console.log(`formData:${formData}`);
    this.file = file;

    //this.http.post(url, formData, request_options)
  }

  buildReferencesMap(): ReferencesMap {
    let referencesMap: ReferencesMap;
    console.log(`in buildReferencesMap`);
    let fileData;
    //console.log(`References: ${fileData.References}`);

    // fileData.References.forEach(reference=>{

    // })

    this.exportedAtd = JSON.parse(this.exportedAtdstring);
    let exportReferences = this.exportedAtd.References;

    let referencesData: any = this.GetReferencesData(exportReferences);
    exportReferences.forEach((ref) => {
      let referencesList: any = {};
      if (
        ref.Type == ReferenceType.Catalog ||
        ref.Type == ReferenceType.Profile ||
        ref.Type == ReferenceType.ActivityTypeDefinition ||
        ref.Type == ReferenceType.CustomizationFile
      ) {
        switch (ref.Type) {
          case ReferenceType.Catalog:
            referencesList = referencesData.catalogs;
            break;
          case ReferenceType.Profile:
            referencesList = referencesData.profiles;
            break;
          case ReferenceType.ActivityTypeDefinition:
            referencesList = referencesData.types;
            break;
          case ReferenceType.CustomizationFile:
            referencesList = referencesData.files;
            break;
        }
        referencesList.forEach((element) => {
          if (element.InternalID === ref.ID) {
            this.addReferencesPair(element, ref, referencesMap);
          }
          if (element.ExternalID === ref.Name) {
            this.addReferencesPair(element, ref, referencesMap);
          }
        });
      } else if (
        ref.Type == ReferenceType.UserDefinedTable ||
        ref.Type == ReferenceType.Filter
      ) {
        switch (ref.Type) {
          case ReferenceType.UserDefinedTable:
            referencesList = referencesData.udts;
            referencesList.forEach((element) => {
              if (element.InternalID === ref.ID) {
                this.addReferencesPair(element, ref, referencesMap);
              }
              if (element.FileName === ref.Name) {
                this.addReferencesPair(element, ref, referencesMap);
              }
            });
            break;
          case ReferenceType.Filter:
            referencesList = referencesData.filters;
            referencesList.forEach((element) => {
              if (element.InternalID === ref.ID) {
                this.addReferencesPair(element, ref, referencesMap);
              }
              if (element.TableID === ref.Name) {
                this.addReferencesPair(element, ref, referencesMap);
              }
            });
            break;
        }
      }
    });

    console.log(referencesData);
    return referencesMap;
  }

  private addReferencesPair(
    element: any,
    ref: Reference,
    referencesMap: ReferencesMap
  ) {
    let destinitionRef: Reference = {
      ID: element.InternalID,
      UUID: element.UUID,
      Name: element.ExternalID,
      Type: ReferenceType.Catalog,
    };
    let pair: Pair;
    pair.origin = ref;
    pair.destinition = destinitionRef;

    referencesMap.Pairs.push(pair);
  }

  private GetReferencesData(
    exportReferences: import("c:/Users/hadar.l/Documents/New Framwork Hadar Tests/ImportExportATD/server-side/api").Reference[]
  ) {
    let profileIndex = exportReferences.findIndex(
      (x) => x.Type.valueOf() === ReferenceType.Profile.valueOf()
    );
    let genericListIndex = exportReferences.findIndex(
      (x) => x.Type == ReferenceType.GenericList
    );
    let fileIndex = exportReferences.findIndex(
      (x) => ReferenceType.CustomizationFile
    );
    let activityTypeDefinitionIndex = exportReferences.findIndex(
      (x) => ReferenceType.ActivityTypeDefinition
    );
    let catalogIndex = exportReferences.findIndex(
      (x) => x.Type == ReferenceType.Catalog
    );
    let filterIndex = exportReferences.findIndex((x) => ReferenceType.Filter);
    let udtIndex = exportReferences.findIndex(
      (x) => x.Type == ReferenceType.UserDefinedTable
    );
    let referencesData: any = {};

    if (profileIndex > -1) {
      this.getReferencesDataObject("/profiles").then(
        (res) => (referencesData.profiles = res)
      );
    }
    if (genericListIndex > -1) {
    }
    if (fileIndex > -1) {
      this.getReferencesFiles().then((res) => (referencesData.files = res));
    }
    if (activityTypeDefinitionIndex > -1) {
      this.getReferencesTypes().then((res) => (referencesData.types = res));
    }
    if (catalogIndex > -1) {
      this.getReferencesDataObject("Catalog").then(
        (res) => (referencesData.catalogs = res)
      );
    }
    if (filterIndex > -1) {
      this.getReferencesMetaDataObject("filters").then(
        (res) => (referencesData.filters = res)
      );
    }
    if (udtIndex > -1) {
      this.getUDTs().then((res) => (referencesData.udts = res));
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
export enum ReferenceType {
  None = 0,
  Profile = 1,
  GenericList = 2,
  CustomizationFile = 3,
  ActivityTypeDefinition = 4,
  Catalog = 5,
  Filter = 6,
  UserDefinedTable = 7,
}
