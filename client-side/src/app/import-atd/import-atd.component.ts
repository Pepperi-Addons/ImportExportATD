import { Component, OnInit, ViewChild } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonApiService } from "../addon-api.service";
// @ts-ignore
import { UserService } from "pepperi-user-service";
import { KeyValuePair, ImportAtdService } from "./import-atd.service";
import { PluginService } from "../plugin.service";
import { PapiClient } from "@pepperi-addons/papi-sdk";
import { __param } from "tslib";
import {
  ActivityTypeDefinition,
  ReferenceType,
  ReferencesMap,
} from "../../../../server-side/api";

@Component({
  selector: "app-import-atd",
  templateUrl: "./import-atd.component.html",
  styleUrls: ["./import-atd.component.scss"],
})
export class ImportAtdComponent implements OnInit {
  // @ViewChild('fileInput')

  file: File | null = null;
  data: any;
  apiEndpoint: string;
  installing: boolean = false;
  addonData: any = {};
  activityTypes: KeyValuePair<string>[];
  selectedActivity: any;
  selectedFile: File;
  showConflictResolution: boolean = false;
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

  importAtd() {
    console.log(`selectedActivity: ${this.selectedActivity}`);
    let referenceMap: ReferencesMap = this.importatdService.buildReferencesMap();
    if (referenceMap && referenceMap.Pairs.length > 0) {
      this.showConflictResolution = true;
    }
    // const self = this;
    // console.log(`in exportAtd`);
    // let subtype =  `141056`;
    // self.userService.setShowLoading(true);
    // // call to export_atd
    // let typeString = ``;
    // this.importatdService.papiClient.get(`types/${subtypeid}`).then((type)=>{
    //   if (type.Type === 2){
    //     typeString=`transactions`
    //   }
    //   else{
    //     typeString=`activities`
    //   }
    //   const exportAtdResult = this.importatdService.papiClient.addons.api.uuid(this.importatdService.pluginUUID).file('api').func('export_atd').get({ type:typeString,  subtype:subtypeid }).then(
    //     (res: any) => {
    //       self.data = res;
    //       self.userService.setShowLoading(false)
    //   },
    //   (error) => {},
    //   )
    // });
  }

  onFileSelect(event) {
    let files = event.target.files;
    if (files.length > 0) {
      console.log(files[0]); // You will see the file
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
