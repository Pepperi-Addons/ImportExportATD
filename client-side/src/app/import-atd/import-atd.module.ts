import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { MatButtonModule, MatIconModule } from "@angular/material";
import { ListViewComponent } from "../list-view/list-view.component";
import { ImportAtdComponent } from "..//import-atd/import-atd.component"
import { PepperiListContComponent } from "../pepperi-list/pepperi-list.component";

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    MatButtonModule,
    BrowserModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    ListViewComponent,
    PepperiListContComponent,
    ImportAtdComponent
  ],
})
export class ImportAtdModule {}
