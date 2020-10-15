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
  conflictsList: Conflict[] = [];
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

  async onOkClicked() {
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
          let res = await this.importatdService.papiClient.fileStorage.upsert(
            file
          );
          console.log(
            `afetr posting file storage. body: ${JSON.stringify(
              file
            )}, res: ${JSON.stringify(res)}`
          );
          this.referenceMap.Pairs[
            referenceIndex
          ].origin.ID = res.InternalID.toString();
        } else if (
          conflict.Object === ReferenceType.toString(ReferenceType.Filter)
        ) {
          let filter = {
            name: `TransactionItemScope_${this.selectedActivity}`,
            Data: this.referenceMap.Pairs[referenceIndex].origin.Content,
            DataType: {
              ID: 10,
            },
            ContextObject: {
              UUID: typeUUID,
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
          this.referenceMap.Pairs[
            referenceIndex
          ].origin.ID = res.InternalID.toString();
        } else if (
          conflict.Object ===
          ReferenceType.toString(ReferenceType.UserDefinedTable)
        ) {
          let res = await this.importatdService.papiClient.metaData.userDefinedTables.upsert(
            JSON.parse(this.referenceMap.Pairs[referenceIndex].origin.Content)
          );
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

    const presignedUrl = await this.importatdService.papiClient.post(
      `/file_storage/tmp`
    );

    let typeString = ``;
    let typeUUID = ``;

    await this.importatdService.papiClient
      .get(`/types/${this.selectedActivity}`)
      .then((type) => {
        typeUUID = type.UUID;
        if (type.Type === 2) {
          typeString = `transactions`;
        } else {
          typeString = `activities`;
        }
      });

    await fetch(presignedUrl.UploadURL, {
      method: `PUT`,
      body: this.importatdService.exportedAtdstring,
    });

    let url = presignedUrl.DownloadURL;
    const self = this;
    self.userService.setShowLoading(true);

    console.log(this.referenceMap);
    console.log(
      `calling to api\import_atd. body: url: ${url}, ReferencesMap: ${JSON.stringify(
        this.referenceMap
      )}`
    );
    const importAtdResult = this.importatdService.papiClient.addons.api
      .uuid(this.importatdService.pluginUUID)
      .file("api")
      .func("importAtd")
      .post(
        { type: typeString, subtype: this.selectedActivity },
        { ExportAtdResultURL: url, ReferencesMap: this.referenceMap }
      )
      .then(
        (res: any) => {
          debugger;
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
          self.data = res;
          self.userService.setShowLoading(false);
        },
        (error) => {}
      );
  }

  async onCancelClicked() {}

  async importAtd() {
    console.log(`selectedActivity: ${this.selectedActivity}`);
    let referenceMap: ReferencesMap = await this.importatdService.buildReferencesMap();
    this.referenceMap = referenceMap;
    if (referenceMap && referenceMap.Pairs.length > 0) {
      let identifier: String = ``;
      this.conflictsList = await this.getConflictsResulotion(referenceMap);
      debugger;
      if (this.conflictsList && this.conflictsList.length > 0) {
        this.showConflictResolution = true;
      } else {
        this.onOkClicked();
      }
      console.log("this.conflictsList", this.conflictsList);

      this.typesList ? this.typesList.reload() : null;
    }
  }

  async getConflictsResulotion(referenceMap: ReferencesMap) {
    let conflicts: Conflict[] = [];

    const refMaps = this.importatdService.exportedAtd.References;

    for (let i = 0; i < refMaps.length; i++) {
      await this.handleReference(refMaps[i], conflicts, referenceMap);
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
          const title = `error`; // this.translate.instant("Archive_PublishModal_Title");
          // const content = this.translate.instant("Archive_PublishModal_Failure", {
          //     message: ('message' in error) ? error.message : 'Unknown error occured'
          // });
          const content = `error`;
          this.pluginService.openTextDialog(title, content, [actionButton]);
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
            debugger;
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
            debugger;
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
    debugger;
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
