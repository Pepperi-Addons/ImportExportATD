import { NgModule } from "@angular/core";
import { PluginComponent } from "./plugin.component";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import {
  MatTabsModule,
  MatIconModule,
  MatInputModule,
  MatCheckboxModule,
  MatFormFieldModule,
  MatDialogModule,
  MatCardModule,
  MatSelectModule,
  MatButton,
  MatButtonModule,
} from "@angular/material";

// @ts-ignore
import { TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
// @ts-ignore
// import { PepperiTextareaComponent } from 'pepperi-textarea';
import { DynamicModule, DynamicComponent } from "ng-dynamic-component";
import { ignoreElements } from "rxjs/operators";
//@ts-ignore
import { EnvVariables } from "pepperi-environment-variables";

import { HttpClientModule, HttpClient } from "@angular/common/http";
import { AddonApiService } from "./addon-api.service";
import { ExportAtdComponent } from "./export-atd/export-atd.component";
import { ImportAtdComponent } from "./import-atd/import-atd.component";

import { ListViewComponent } from "./list-view/list-view.component";
import { PepperiListContComponent } from "./pepperi-list/pepperi-list.component";

function getUrl() {
}
@NgModule({
  declarations: [
    ImportAtdComponent,
    PluginComponent,
    ExportAtdComponent,
    //ImportAtdComponent,
    ListViewComponent,
    PepperiListContComponent,
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    MatTabsModule,
    MatIconModule,
    MatInputModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient, AddonApiService],
      },
    }),
    FormsModule,
    ReactiveFormsModule,
    DynamicModule.withComponents([]),
  ],
  exports: [],
  providers: [
    {
      provide: "plugins",
      useValue: [
        {
          name: "plugin-component",
          component: PluginComponent,
        },
      ],
      multi: true,
    },
    AddonApiService,
  ],
  entryComponents: [PluginComponent, DynamicComponent],
})
export class PluginModule {}

export function createTranslateLoader(
  http: HttpClient,
  apiService: AddonApiService,
  url: string = ""
) {
  if (!url) {
    url = apiService.getAddonStaticFolderURL();
  }
  return new TranslateHttpLoader(http, url, ".json");
}
export class Guid {
  static newGuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (
      c
    ) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
