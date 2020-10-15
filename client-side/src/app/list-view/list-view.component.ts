import {
  Component,
  OnInit,
  Input,
  ViewChild,
  Output,
  EventEmitter,
} from "@angular/core";
import { PluginService } from "src/app/plugin.service";
import {
  PepperiListService,
  PepperiListContComponent,
} from "../pepperi-list/pepperi-list.component";
import { Router, ActivatedRoute } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { Conflict } from "../../../../models/Conflict";
//import { ScheduledType } from "src/app/plugin.model";

@Component({
  selector: "app-list-view",
  templateUrl: "./list-view.component.html",
  styleUrls: ["./list-view.component.scss"],
  providers: [PluginService],
})
export class ListViewComponent implements OnInit {
  @Output() actionClicked: EventEmitter<{
    ApiName: string;
    SelectedItem?: any;
  }> = new EventEmitter<{ ApiName: string; SelectedItem?: any }>();

  @Input() conflicts: Conflict[];

  @Input() pepperiListOutputs;

  service: PepperiListService = {
    getDataView: (translates) => {
      return {
        Context: {
          Name: "",
          Profile: { InternalID: 0 },
          ScreenSize: "Landscape",
        },
        Type: "Grid",
        Title: translates ? translates["Conflict_Resolution_Title"] : "",
        IsEditble: true,
        Fields: [
          {
            FieldID: "Object",
            Type: "TextBox",
            Title: translates
              ? translates["Object_ConflictResolutionColumn"]
              : "",
            Mandatory: false,
            Enabled: false,
            ReadOnly: true,
          },
          {
            FieldID: "Name",
            Type: "TextBox",
            Title: translates
              ? translates["Name_ConflictResolutionColumn"]
              : "",
            Mandatory: false,
            Enabled: false,
            ReadOnly: true,
          },
          {
            FieldID: "Status",
            Type: "TextBox",
            Title: translates
              ? translates["Status_ConflictResolutionColumn"]
              : "",
            Enabled: false,
            Mandatory: false,
            ReadOnly: true,
          },
          {
            FieldID: "Resolution",
            Type: "ComboBox",
            Title: translates
              ? translates["Resulotion_ConflictResolutionColumn"]
              : "",
            Mandatory: false,
            ReadOnly: false,
          },
        ],
        Columns: [
          {
            Width: 10,
          },
          {
            Width: 10,
          },
          {
            Width: 10,
          },
          {
            Width: 10,
          },
        ],
        FrozenColumnsCount: 0,
        MinimumColumnWidth: 0,
      };
    },

    getActions: (translates) => {
      return [
        {
          Key: "Edit",
          Title: translates ? translates["Archive_TypesTable_EditAction"] : "",
          Filter: (obj) => true,
          Action: (obj) => {
            this.actionClicked.emit({ ApiName: "Edit", SelectedItem: obj });
          },
        },
        {
          Key: "Delete",
          Title: translates
            ? translates["Archive_TypesTable_DeleteAction"]
            : "",
          Filter: (obj) => true,
          Action: (obj) => {
            this.actionClicked.emit({ ApiName: "Delete", SelectedItem: obj });
          },
        },
      ];
    },

    // rightButtons: (translates) => {
    //   return [
    //     {
    //       Title: translates ? translates["Archive_TypesTable_AddAction"] : "",
    //       Icon: "number-plus",
    //       Action: () => this.actionClicked.emit({ ApiName: "Add" }),
    //     },
    //   ];
    // },

    getList: () => {
      return new Promise((resolve, reject) => {
        if (this.conflicts) {
          console.log("conflictlist: " + JSON.stringify(this.conflicts));

          resolve(this.conflicts);
        }
      });
    },
  };

  translates: string[] = [];

  @ViewChild("list", { static: false })
  list: PepperiListContComponent;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {}

  ngOnChanges() {}

  reload() {
    this.list.loadlist();
  }
}
