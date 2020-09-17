import { Injectable, Type } from "@angular/core";
//@ts-ignore
import { AddonService } from "pepperi-addon-service";
import {
  ReferencesMap,
  Pair,
  ActivityTypeDefinition,
  Reference,
} from "./../../../../server-side/api";
import {
  PapiClient,
  FileStorage,
  UserDefinedTableMetaData,
} from "@pepperi-addons/papi-sdk";
import jwt from "jwt-decode";
import { ignoreElements } from "rxjs/operators";

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

  async buildReferencesMap(): Promise<ReferencesMap> {
    let referencesMap = {} as ReferencesMap;
    referencesMap.Pairs = [];
    console.log(`in buildReferencesMap`);
    let fileData;
    //console.log(`References: ${fileData.References}`);

    // fileData.References.forEach(reference=>{

    // })

    this.exportedAtd = JSON.parse(this.exportedAtdstring);
    let exportReferences = this.exportedAtd.References;

    let referencesData: ReferenceData = await this.GetReferencesData(
      exportReferences
    );

    exportReferences.forEach((ref) => {
      let referencesList = [];
      if (
        ref.Type === ReferenceType.Catalog ||
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
          if (element.InternalID && element.InternalID.toString() === ref.ID) {
            this.addReferencesPair(element, ref, referencesMap);
          } else if (
            element.ExternalID &&
            element.ExternalID.toString() === ref.Name
          ) {
            this.addReferencesPair(element, ref, referencesMap);
          } else if (element.Name && element.Name.toString() === ref.Name) {
            this.addReferencesPair(element, ref, referencesMap);
          }
        });
      } else if (
        ref.Type == ReferenceType.UserDefinedTable ||
        ref.Type == ReferenceType.Filter
      ) {
        switch (ref.Type.toString()) {
          case ReferenceType[ReferenceType.UserDefinedTable]:
            referencesList = referencesData.udts;

            referencesList.forEach((element) => {
              if (
                element.InternalID &&
                element.InternalID.toString() === ref.ID
              ) {
                this.addReferencesPair(element, ref, referencesMap);
              }
              if (
                element.FileName &&
                element.FileName.toString() === ref.Name
              ) {
                this.addReferencesPair(element, ref, referencesMap);
              }
            });

            break;

          case ReferenceType[ReferenceType.Filter]:
            referencesList = referencesData.filters;
            referencesList.forEach((element) => {
              if (element.FileName && element.FileName === ref.ID) {
                this.addReferencesPair(element, ref, referencesMap);
              }
              if (element.TableID && element.TableID === ref.Name) {
                this.addReferencesPair(element, ref, referencesMap);
              }
            });

            break;
        }
      }
    });

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
    destinitionRef.Type = ref.Type;
    if (element.ExternalID != undefined) {
      destinitionRef.Name = element.ExternalID;
    } else {
      destinitionRef.Name = element.Name;
    }
    let originRef: Reference = {
      ID: ref.ID,
      UUID: ref.UUID,
      Name: ref.Name,
      Type: ref.Type,
    };
    let pair = {} as Pair;

    pair.origin = originRef;
    pair.destinition = destinitionRef;
    referencesMap.Pairs.push(pair);
  }

  private async GetReferencesData(
    exportReferences: Reference[]
  ): Promise<ReferenceData> {
    let profileIndex = exportReferences.findIndex(
      (x) => x.Type === ReferenceType.Profile
    );
    let genericListIndex = exportReferences.findIndex(
      (x) => x.Type === ReferenceType.GenericList
    );
    let fileIndex = exportReferences.findIndex(
      (x) => x.Type === ReferenceType.CustomizationFile
    );
    let activityTypeDefinitionIndex = exportReferences.findIndex(
      (x) => x.Type === ReferenceType.ActivityTypeDefinition
    );
    let catalogIndex = exportReferences.findIndex(
      (x) => x.Type === ReferenceType.Catalog
    );
    let filterIndex = exportReferences.findIndex(
      (x) => x.Type === ReferenceType.Filter
    );
    let udtIndex = exportReferences.findIndex(
      (x) => x.Type === ReferenceType.UserDefinedTable
    );
    let referencesData = {} as ReferenceData;

    if (profileIndex > -1) {
      await this.getReferencesDataObject("/profiles").then(
        (res) => (referencesData.profiles = res)
      );
    }
    if (genericListIndex > -1) {
    }
    if (fileIndex > -1) {
      await this.getReferencesFiles().then(
        (res) => (referencesData.files = res)
      );
    }
    if (activityTypeDefinitionIndex > -1) {
      await this.getReferencesTypes().then(
        (res) => (referencesData.types = res)
      );
    }
    if (catalogIndex > -1) {
      await this.getReferencesDataObject("Catalog").then(
        (res) => (referencesData.catalogs = res)
      );
    }
    if (filterIndex > -1) {
      await this.getReferencesMetaDataObject("filters").then(
        (res) => (referencesData.filters = res)
      );
    }
    if (udtIndex > -1) {
      await this.getUDTs().then((res) => (referencesData.udts = res));
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
export interface Conflict {
  Object: string;
  Name: string;
  Status: string;
  Options: KeyValuePair<String>[];
}
export interface ReferenceData {
  filters: [];
  udts: UserDefinedTableMetaData[];
  files: FileStorage[];
  //@ts-ignore
  types: Type[];
  profiles: [];
  catalogs: [];
}
export enum ReferenceType {
  None,
  Profile,
  GenericList,
  CustomizationFile,
  ActivityTypeDefinition,
  Catalog,
  Filter,
  UserDefinedTable,
}
export enum ResolutionOption {
  Blank = 0,
  Overwrite = 1,
}
