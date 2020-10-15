import { Component, ViewEncapsulation, OnInit, OnDestroy } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonApiService } from "./addon-api.service";
import { PluginService } from "./plugin.service";
import { KeyValuePair } from "../../../models/keyValuePair";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "plugin",
  templateUrl: "./plugin.component.html",
  styleUrls: ["./plugin.component.scss"],
  providers: [],
  // To override parent component styling
  encapsulation: ViewEncapsulation.None,
})
export class PluginComponent implements OnInit, OnDestroy {
  installing: boolean = false;
  addonData: any = {};
  activityTypes: KeyValuePair<string>[];
  selectedActivity: any;
  view: string = "import";

  constructor(
    public translate: TranslateService,
    public routeParams: ActivatedRoute,
    private addonApiService: AddonApiService,
    private pluginService: PluginService
  ) {
    this.routeParams.queryParams.subscribe((queryParams) => {
      this.view = queryParams.view || "import";
    });
    let userLang = "en";
    translate.setDefaultLang(userLang);
    userLang = translate.getBrowserLang().split("-")[0]; // use navigator lang if available
    translate.use(userLang);
    this.getActivityTypes();
  }

  getActivityTypes() {
    this.activityTypes = [];
    this.pluginService.getTypes((types) => {
      if (types) {
        types.sort((a, b) => a.Value.localeCompare(b.Value));
        this.activityTypes = [...types];
      }
    });
  }

  ngOnInit() {
    this.addonApiService.addonData = this.addonData;
  }

  ngOnDestroy() {}
}
