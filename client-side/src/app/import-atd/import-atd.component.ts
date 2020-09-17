import { Component, OnInit, ViewChild } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonApiService } from "../addon-api.service";
// @ts-ignore
import { UserService } from "pepperi-user-service";
import {
  KeyValuePair,
  ImportAtdService,
  Conflict,
  ReferenceType,
} from "./import-atd.service";
import { PluginService } from "../plugin.service";
import { PapiClient } from "@pepperi-addons/papi-sdk";
import { __param } from "tslib";
import {
  ActivityTypeDefinition,
  ReferencesMap,
  Pair,
} from "../../../../server-side/api";
import { disableDebugTools } from "@angular/platform-browser";
import { ListViewComponent } from "../list-view/list-view.component";
import { pairs } from "rxjs";
import { exception } from "console";

@Component({
  selector: "app-import-atd",
  templateUrl: "./import-atd.component.html",
  styleUrls: ["./import-atd.component.scss"],
})
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

  constructor(
    private translate: TranslateService,
    private backendApiService: AddonApiService,
    private userService: UserService,

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

  async importAtd() {
    console.log(`selectedActivity: ${this.selectedActivity}`);

    let referenceMap: ReferencesMap = await this.importatdService.buildReferencesMap();
    
    if (referenceMap && referenceMap.Pairs.length > 0) {
      let identifier: String = ``;
      this.showConflictResolution = true;
      debugger;
      this.conflictsList = this.getConflictsResulotion(referenceMap);
      this.typesList ? this.typesList.reload() : null;
    }
  }

  getConflictsResulotion(referenceMap: ReferencesMap): Conflict[] {
    let conflicts: Conflict[] = [];
    this.importatdService.exportedAtd.References.forEach((ref) => {
      
      if (referenceMap === null || referenceMap.Pairs.length === 0) {
        //throw new exception("Error");
      } else {
        let referencedPair: Pair = referenceMap.Pairs.find(
          (pair) => pair.origin.ID === ref.ID || pair.origin.Name === ref.Name
        );
        if (referencedPair === null) {
          // For objects with a path (such as custom form), if a matching object does not exist, then continue (create this object in the Execution step).
          if (ref.Type === ReferenceType.CustomizationFile) {
            return;
          } else {
            //throw new exception("Error");
          }
        } else if (referencedPair.origin.ID === referencedPair.destinition.ID) {
          return;
        } else if (
          referencedPair.origin.Name === referencedPair.destinition.Name
        ) {
        let types:KeyValuePair<string>[] = [];
        types.push({ Key: "0", Value: "0"})

          const conflict: Conflict = {
            Name: referencedPair.destinition.Name,
            Object: ReferenceType[referencedPair.destinition.Type],
            Status: `${ReferenceType[referencedPair.destinition.Type]} with the same name exists`,
            Options: types
          };
          conflicts.push(conflict);
        }
      }
    });
    return conflicts;
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

  uploadFile(event) {
    let files = event.target.files;
    if (files.length > 0) {
      console.log(files[0]); // You will see the file
      this.importatdService.uploadFile(files[0]);
    }
  }
}
