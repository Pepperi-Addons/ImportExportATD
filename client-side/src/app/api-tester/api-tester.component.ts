import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AddonApiService } from '../addon-api.service';
// @ts-ignore
import { UserService } from "pepperi-user-service";
import { KeyValuePair, ApiTesterService } from './api-tester.service';
import { PluginService } from '../plugin.service';
import { PapiClient } from '@pepperi-addons/papi-sdk';
import { __param } from 'tslib';

@Component({
  selector: 'app-api-tester',
  templateUrl: './api-tester.component.html',
  styleUrls: ['./api-tester.component.scss']
})
export class ApiTesterComponent implements OnInit {

  data: any
  apiEndpoint: string
  installing: boolean = false;
  addonData: any = {};
  activityTypes: KeyValuePair<string>[];
  selectedActivity:any;
  
  constructor(
    private translate: TranslateService,
    private backendApiService: AddonApiService,
    private userService: UserService,

    private apitesterService: ApiTesterService
  ) {
    this.getActivityTypes();

   }
   getActivityTypes() {
    this.activityTypes = [];
    this.apitesterService.getTypes((types) => {
        if (types) {
            types.sort((a, b) => a.Value.localeCompare(b.Value))
            this.activityTypes = [...types];
          }
    });
}
  ngOnInit(): void {
  }

  exportAtd(subtypeid) {
    
    console.log(`parameter that retured: ${subtypeid}`);

    const self = this;
    console.log(`in exportAtd`);
    let subtype =  `141056`;
    self.userService.setShowLoading(true);
    // call to export_atd
    let typeString = ``;
    this.apitesterService.papiClient.get(`types/${subtypeid}`).then((type)=>{
      if (type.Type === 2){
        typeString=`transactions`
      }
      else{
        typeString=`activities`
      }
      const exportAtdResult = this.apitesterService.papiClient.addons.api.uuid(this.apitesterService.pluginUUID).file('api').func('export_atd').get({ type:typeString,  subtype:subtypeid }).then(
        (res: any) => {
          self.data = res;
          self.userService.setShowLoading(false)
      },
      (error) => {},
      )
    });    
  }
}
