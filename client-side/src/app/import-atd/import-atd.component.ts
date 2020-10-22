import { Component, OnInit, ViewChild } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonApiService } from "../addon-api.service";
// @ts-ignore
import { UserService } from "pepperi-user-service";
import { ImportAtdService } from "./import-atd.service";
import { Reference } from "./../../../../models/reference";
import { Conflict } from "./../../../../models/conflict";
import { ReferencesMap, Pair } from "./../../../../models/referencesMap";
import { __param } from "tslib";
import { ListViewComponent } from "../list-view/list-view.component";
import { Guid } from "../plugin.module";
import { FileStorage } from "@pepperi-addons/papi-sdk";
import { PluginService } from "../plugin.service"; //./plugin.service";
import { KeyValuePair } from "./../../../../models/keyValuePair";
import { ReferenceType } from "./../../../../models/referenceType";
import { Webhook } from "./../../../../models/Webhook";
import { ResolutionOption } from "./../../../../models/resolutionOption.enum";

@Component({
  selector: "app-import-atd",
  templateUrl: "./import-atd.component.html",
  styleUrls: ["./import-atd.component.scss"],
})

//type ReferenceType = typeof ReferenceType[keyof typeof ReferenceType];
//type ResolutionOption = typeof ResolutionOption[keyof typeof ResolutionOption];
export class ImportAtdComponent implements OnInit {
  @ViewChild(ListViewComponent, { static: false }) typesList: ListViewComponent;

  file: File | null = null;
  data: any;
  apiEndpoint: string;
  installing: boolean = false;
  addonData: any = {};
  activityTypes: KeyValuePair<string>[];
  selectedActivity: any;
  selectedFile: File;
  showConflictResolution: boolean = false;
  showWebhooksResolution: boolean = false;

  conflictsList: Conflict[] = [];
  webhooks: Webhook[] = [];
  typeString = ``;
  typeUUID = ``;

  referenceMap: ReferencesMap;

  pepperiListOutputs: any = {
    notifyListChanged: (event) => {},
    notifySortingChanged: (event) => {},
    notifyFieldClicked: (event) => {},
    notifySelectedItemsChanged: (event) => {},
    notifyValueChanged: (event) => {
      //   let index = this.conflictsList.findIndex((x) => x.Name === event.ApiName);
      //   this.conflictsList[index].Resolution = ReferenceType[event.Value];
      // "{"Id":"7b5444dd-9b5c-4250-8420-6e9936b3eb7d","ApiName":"Resolution","Value":"1","ControlType":""}"
      //this.conflictsList.find(c => )
    },
    //this.selectedRowsChanged(event, translates),
  };

  constructor(
    private translate: TranslateService,
    private backendApiService: AddonApiService,
    private userService: UserService,
    public pluginService: PluginService,
    private importatdService: ImportAtdService
  ) {
    this.getActivityTypes();
  }
  getActivityTypes() {
    this.activityTypes = [];
    this.importatdService.getTypes((types) => {
      if (types) {
        types.sort((a, b) => a.Value.localeCompare(b.Value));
        this.activityTypes = [...types];
      }
    });
  }
  ngOnInit(): void {}

  async onOkConflictsClicked() {
    this.conflictsList.forEach(async (conflict) => {
      let referenceIndex = this.referenceMap.Pairs.findIndex(
        (pair) => pair.origin.Name === conflict.Name
      );
      if (
        conflict.Resolution ===
        ResolutionOption.toString(ResolutionOption.CreateNew)
      ) {
        if (
          conflict.Object ===
          ReferenceType.toString(ReferenceType.CustomizationFile) // ReferenceType[ReferenceType.CustomizationFile]
        ) {
          debugger;
          let res = await this.upsertFileStorage(referenceIndex);
          this.referenceMap.Pairs[
            referenceIndex
          ].origin.ID = res.InternalID.toString();
        } else if (
          conflict.Object === ReferenceType.toString(ReferenceType.Filter)
        ) {
          let transactionItemScope = await this.getTransactionItemScope(
            this.selectedActivity
          );
          if (
            transactionItemScope === null ||
            transactionItemScope.length === 0
          ) {
            let res = await this.upsertTransactionItemScope(referenceIndex);
            this.referenceMap.Pairs[
              referenceIndex
            ].origin.ID = res.InternalID.toString();
          }
        } else if (
          conflict.Object ===
          ReferenceType.toString(ReferenceType.UserDefinedTable)
        ) {
          debugger;
          let res = await this.upsertUDT(referenceIndex);
          this.referenceMap.Pairs[
            referenceIndex
          ].origin.Name = res.TableID.toString();
        }
      } else if (
        conflict.Resolution ===
        ResolutionOption.toString(ResolutionOption.OverwriteExisting)
      ) {
        if (
          conflict.Object ===
          ReferenceType.toString(ReferenceType.CustomizationFile)
        ) {
          let file: FileStorage = {
            InternalID: Number(
              this.referenceMap.Pairs[referenceIndex].destinition.ID
            ),
            FileName: this.referenceMap.Pairs[referenceIndex].destinition.Name,
            URL: this.referenceMap.Pairs[referenceIndex].origin.Path,
            Title: this.referenceMap.Pairs[referenceIndex].destinition.Name,
          };
          let res = await this.importatdService.papiClient.fileStorage.upsert(
            file
          );
          this.referenceMap.Pairs[
            referenceIndex
          ].destinition.ID = res.InternalID.toString();
        }
      }
    });
    const self = this;

    debugger;
    if (this.webhooks.length > 0) {
      this.showConflictResolution = false;
      this.showWebhooksResolution = true;
    } else {
      this.callToImportATD();
    }
    console.log(this.referenceMap);
  }

  private async upsertUDT(referenceIndex: number) {
    let udt = JSON.parse(
      this.referenceMap.Pairs[referenceIndex].origin.Content
    );
    delete udt.InternalID;
    let res = await this.importatdService.papiClient.metaData.userDefinedTables.upsert(
      udt
    );
    return res;
  }

  private async upsertTransactionItemScope(referenceIndex: number) {
    let filter = {
      name: `Transaction Item Scope`,
      Data: JSON.parse(this.referenceMap.Pairs[referenceIndex].origin.Content),
      DataType: {
        ID: 10,
      },
      ContextObject: {
        UUID: this.typeUUID,
        Type: {
          ID: 98,
          Name: "ActivityTypeDefinition",
        },
      },
    };
    let res = await this.importatdService.papiClient.post(
      "/meta_data/filters",
      filter
    );
    console.log(
      `afetr posting filter. body: ${JSON.stringify(
        this.referenceMap.Pairs[referenceIndex].origin.Content
      )}, res: ${JSON.stringify(res)}`
    );
    return res;
  }

  private async upsertFileStorage(referenceIndex: number) {
    debugger;
    let file: FileStorage = {
      FileName: this.referenceMap.Pairs[referenceIndex].origin.Name,
      URL: this.referenceMap.Pairs[referenceIndex].origin.Path,
      Title: this.referenceMap.Pairs[referenceIndex].origin.Name,
      Configuration: {
        ObjectType: "Order",
        Type: "CustomClientForm",
        RequiredOperation: "NoOperation",
      },
    };
    let res = await this.importatdService.papiClient.fileStorage.upsert(file);
    console.log(
      `afetr posting file storage. body: ${JSON.stringify(
        file
      )}, res: ${JSON.stringify(res)}`
    );
    return res;
  }

  async getTransactionItemScope(subtype: string) {
    return await this.importatdService.papiClient.get(
      `/meta_data/lists/all_activities?where=Name='Transaction Item Scope'`
    );
  }

  async onOkWebhooksClicked() {
    this.webhooks.forEach(async (webhook) => {
      let referenceIndex = this.referenceMap.Pairs.findIndex(
        (pair) => pair.origin.UUID === webhook.UUID
      );
      if (
        webhook.Url !==
        this.referenceMap.Pairs[referenceIndex].origin.Content.WEBHOOK_URL
      ) {
        this.referenceMap.Pairs[
          referenceIndex
        ].destinition.Content.WEBHOOK_URL = webhook.Url;
      }
      if (
        webhook.SecretKey !==
        this.referenceMap.Pairs[referenceIndex].origin.Content.SECRET_KEY
      ) {
        this.referenceMap.Pairs[referenceIndex].destinition.Content.SECRET_KEY =
          webhook.SecretKey;
      }
    });
    this.callToImportATD();
  }

  private async callToImportATD() {
    debugger;
    const presignedUrl = await this.importatdService.papiClient.post(
      `/file_storage/tmp`
    );
    await fetch(presignedUrl.UploadURL, {
      method: `PUT`,
      body: this.importatdService.exportedAtdstring,
    });

    let url = presignedUrl.DownloadURL;
    console.log(
      `calling to api\import_atd. body: url: ${url}, ReferencesMap: ${JSON.stringify(
        this.referenceMap
      )}`
    );
    this.userService.setShowLoading(true);
    const importAtdResult = this.importatdService.papiClient.addons.api
      .uuid(this.importatdService.pluginUUID)
      .file("api")
      .func("importAtd")
      .post(
        { type: this.typeString, subtype: this.selectedActivity },
        { ExportAtdResultURL: url, ReferencesMap: this.referenceMap }
      )
      .then(
        (res: any) => {
          if (res == "success") {
            const actionButton = {
              title: this.translate.instant("Archive_Confirm"),
              callback: (res) => {},
              className: "",
              icon: null,
            };
            const title = `success`; // this.translate.instant("Archive_PublishModal_Title");

            // const content = this.translate.instant("Archive_PublishModal_Failure", {
            //     message: ('message' in error) ? error.message : 'Unknown error occured'
            // });
            const content = `Import was finished succefully`;
            this.pluginService.openTextDialog(title, content, [actionButton]);
          } else {
            const actionButton = {
              title: this.translate.instant("Archive_Confirm"),
              callback: (res) => {},
              className: "",
              icon: null,
            };
            const title = `Error`; // this.translate.instant("Archive_PublishModal_Title");

            // const content = this.translate.instant("Archive_PublishModal_Failure", {
            //     message: ('message' in error) ? error.message : 'Unknown error occured'
            // });
            const content = `An error occurred while importing`;
            this.pluginService.openTextDialog(title, content, [actionButton]);
          }
          window.clearInterval();
          this.data = res;
          this.userService.setShowLoading(false);
        },
        (error) => {}
      );
  }

  async onCancelClicked() {}

  async importAtd() {
    try {
      console.log(`selectedActivity: ${this.selectedActivity}`);

      await this.fillAtdNameAndUUID();

      let referenceMap: ReferencesMap = await this.importatdService.buildReferencesMap(this.selectedActivity);
      this.referenceMap = referenceMap;
      if (referenceMap && referenceMap.Pairs.length > 0) {
        let identifier: String = ``;
        this.conflictsList = await this.getConflictsResulotion(referenceMap);

        if (this.conflictsList && this.conflictsList.length > 0) {
          this.showWebhooksResolution = false;
          this.showConflictResolution = true;
        } else if (this.webhooks.length > 0) {
          this.showConflictResolution = false;
          this.showWebhooksResolution = true;
        } else {
          this.callToImportATD();
        }
        this.typesList ? this.typesList.reload() : null;
      }
    } catch {}
  }

  private async fillAtdNameAndUUID() {
    await this.importatdService.papiClient
      .get(`/types/${this.selectedActivity}`)
      .then((type) => {
        this.typeUUID = type.UUID;
        if (type.Type === 2) {
          this.typeString = `transactions`;
        } else {
          this.typeString = `activities`;
        }
      });
  }

  async getConflictsResulotion(referenceMap: ReferencesMap) {
    let conflicts: Conflict[] = [];

    const refMaps = this.importatdService.exportedAtd.References;

    for (let i = 0; i < refMaps.length; i++) {
      try {
        await this.handleReference(refMaps[i], conflicts, referenceMap);
      } catch (e) {
        throw e;
      }
    }

    // this.importatdService.exportedAtd.References.forEach(async (ref) => {
    //   await this.handleReference(ref, conflicts, referenceMap);
    // });

    return conflicts;
  }

  async handleReference(
    ref: Reference,
    conflicts: Conflict[],
    referenceMap: ReferencesMap
  ) {
    if (ref.Type !== ReferenceType.Webhook) {
      let referencedPair: Pair = referenceMap.Pairs.find(
        (pair) => pair.origin.ID === ref.ID || pair.origin.Name === ref.Name
      );

      if (referencedPair.destinition === null) {
        // For objects with a path (such as custom form), if a matching object does not exist, then continue (create this object in the Execution step).
        if (
          ref.Type === ReferenceType.CustomizationFile ||
          ref.Type === ReferenceType.UserDefinedTable ||
          ref.Type === ReferenceType.Filter
        ) {
          const conflict: Conflict = {
            Name: ref.Name,
            Object: ReferenceType.toString(referencedPair.origin.Type),
            Status: `Object not found`,
            Resolution: ResolutionOption.toString(ResolutionOption.CreateNew),
            UUID: Guid.newGuid(),
            ID: ref.ID,
            // this.resolutionOptions,
          };
          conflicts.push(conflict);
        } else {
          //throw new exception("Error");
          const actionButton = {
            title: this.translate.instant("Archive_Confirm"),
            callback: (res) => {},
            className: "",
            icon: null,
          };
          debugger;
          const title = `error`; // this.translate.instant("Archive_PublishModal_Title");
          // const content = this.translate.instant("Archive_PublishModal_Failure", {
          //     message: ('message' in error) ? error.message : 'Unknown error occured'
          // });
          const content = `No reference was found with the name: ${
            ref.Name
          } of type: ${ReferenceType.toString(ref.Type)}`;
          this.showWebhooksResolution = false;
          this.showConflictResolution = false;
          this.pluginService.openTextDialog(title, content, [actionButton]);
          throw new Error(content);
        }
      } else if (referencedPair.origin.ID === referencedPair.destinition.ID) {
        return;
      } else if (
        referencedPair.origin.Name === referencedPair.destinition.Name
      ) {
        if (ref.Type === ReferenceType.CustomizationFile) {
          const filesAreSame = await this.compareFileContentOfOriginAndDest(
            referencedPair.origin,
            referencedPair.destinition
          );
          if (!filesAreSame) {
            const conflict: Conflict = {
              Name: referencedPair.destinition.Name,
              Object: ReferenceType.toString(referencedPair.destinition.Type),
              Status: `A file named ${referencedPair.destinition.Name} exists with a different content`,
              Resolution: null,
              UUID: Guid.newGuid(),
              ID: referencedPair.destinition.ID,
              // this.resolutionOptions,
            };
            conflicts.push(conflict);
          }
        }
        // } else {
        //   const conflict: Conflict = {
        //     Name: referencedPair.destinition.Name,
        //     Object: ReferenceType[referencedPair.destinition.Type],
        //     Status: `${
        //       ReferenceType[referencedPair.destinition.Type]
        //     } with the same name exists`,
        //     Resolution: null,
        //     UUID: Guid.newGuid(),
        //     ID: referencedPair.destinition.ID,
        //     // this.resolutionOptions,
        //   };
        //   conflicts.push(conflict);
        // }
      }
    } else {
      const webhook: Webhook = {
        Url: ref.Content.WEBHOOK_URL,
        SecretKey: ref.Content.SECRET_KEY,
        UUID: ref.UUID,
      };

      this.webhooks.push(webhook);
    }
  }

  async compareFileContentOfOriginAndDest(
    origin: Reference,
    destinition: Reference
  ): Promise<boolean> {
    console.log("in compareFileContentOfOriginAndDest");
    let contentOrigin = await this.fileToBase64(origin.Name, origin.Path);
    let contentDestinition = await this.fileToBase64(
      destinition.Name,
      destinition.Path
    );

    console.log(
      `contentOrigin === contentDestinition: ${
        contentOrigin === contentDestinition
      }`
    );

    return contentOrigin === contentDestinition;
  }

  onFileSelect(event) {
    let files = event.target.files;
    if (files.length > 0) {
      console.log(files[0]);
      this.importatdService.uploadFile(files[0]);
    }
    console.log("onFileSelect");

    this.selectedFile = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = reader.result.toString().trim();
      console.log(text);
      this.importatdService.exportedAtdstring = text;
    };
    reader.readAsText(this.selectedFile);
  }

  async fileToBase64(filename, filepath) {
    const responseText = await fetch(filepath).then((r) => r.text());

    return btoa(responseText);

    // return new Promise((resolve) => {
    //   var file = new File(blob, filename); // [filename], );
    //   var reader = new FileReader();
    //   // Read file content on file loaded event
    //   reader.onload = function (event) {
    //     debugger;
    //     resolve(event.target.result);
    //   };

    //   // Convert data to base64
    //   reader.readAsDataURL(file);
    // });
  }

  uploadFile(event) {
    let files = event.target.files;
    if (files.length > 0) {
      console.log(files[0]); // You will see the file
      this.importatdService.uploadFile(files[0]);
    }
  }

  deleteType(selectedObj) {
    // if (selectedObj) {
    //   const index = this.additionalData.ScheduledTypes_Draft.findIndex(
    //     (item) => item.ActivityType.Key == selectedObj.ActivityType.Key
    //   );
    //   index > -1
    //     ? this.additionalData.ScheduledTypes_Draft.splice(index, 1)
    //     : null;
    //   this.pluginService.updateAdditionalData(this.additionalData);
    //   this.typesList ? this.typesList.reload() : null;
    // }
  }
}
