import { Component, OnInit } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonApiService } from "../addon-api.service";
// @ts-ignore
import { UserService } from "pepperi-user-service";
import { KeyValuePair, ExportAtdService } from "./export-atd.service";
import { PluginService } from "../plugin.service";
import { PapiClient } from "@pepperi-addons/papi-sdk";

@Component({
  selector: "app-export-atd",
  templateUrl: "./export-atd.component.html",
  styleUrls: ["./export-atd.component.scss"],
})
export class ExportAtdComponent implements OnInit {
  data: any;
  apiEndpoint: string;
  installing: boolean = false;
  addonData: any = {};
  activityTypes: KeyValuePair<string>[];
  selectedActivity: any;

  constructor(
    private translate: TranslateService,
    private backendApiService: AddonApiService,
    private userService: UserService,
    private exportatdService: ExportAtdService
  ) {
    this.getActivityTypes();
  }

  getActivityTypes() {
    this.activityTypes = [];
    this.exportatdService.getTypes((types) => {
      if (types) {
        types.sort((a, b) => a.Value.localeCompare(b.Value));
        this.activityTypes = [...types];
      }
    });
  }

  ngOnInit(): void {}

  exportAtd(subtypeid) {
    console.log(`parameter that retured: ${subtypeid}`);

    const self = this;
    console.log(`in exportAtd`);
    let subtype = `141056`;
    self.userService.setShowLoading(true);
    // call to export_atd
    let typeString = ``;

    this.exportatdService.papiClient.get(`/types/${subtypeid}`).then((type) => {
      if (type.Type === 2) {
        typeString = `transactions`;
      } else {
        typeString = `activities`;
      }
      const exportAtdResult = this.exportatdService.papiClient.addons.api
        .uuid(this.exportatdService.pluginUUID)
        .file("api")
        .func("export_atd")
        .get({ type: typeString, subtype: subtypeid })
        .then(
          (res: any) => {
            self.data = res;
            self.userService.setShowLoading(false);
          },
          (error) => {}
        );
    });
  }

  downloadUrl() {
    const data = fetch(this.data, {
      method: `GET`,
    })
      .then((response) => response.json())
      .then((data) => {
        console.log(`data: ${JSON.stringify(data)}`);

        var element = document.createElement("a");
        element.setAttribute(
          "href",
          "data:application/plain;charset=utf-8," + JSON.stringify(data)
        );
        element.setAttribute("download", `${this.selectedActivity}.json`);
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      });
  }
  downloadUrl2() {
    const data = fetch(this.data, {
      method: `GET`,
    })
      .then((response) => response.json())
      .then((data) => {
        console.log(`data: ${JSON.stringify(data)}`);
        var fileContents = JSON.stringify(data);
        var filename =`${this.selectedActivity}.json`;
        var filetype = "text/plain";

        var a = document.createElement("a");
        const dataURI = "data:" + filetype + ";base64," + btoa(fileContents);
        a.href = dataURI;
        a["download"] = filename;
        var e = document.createEvent("MouseEvents");
        // Use of deprecated function to satisfy TypeScript.
        e.initMouseEvent(
          "click",
          true,
          false,
          document.defaultView,
          0,
          0,
          0,
          0,
          0,
          false,
          false,
          false,
          false,
          0,
          null
        );
        a.dispatchEvent(e);
        //a.removeNode()
      });
  }
}
