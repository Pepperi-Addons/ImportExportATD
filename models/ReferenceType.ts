export const ReferenceType = Object.freeze({
  None: 0,
  GenericList: 1,
  ActivityTypeDefinition: 2,
  Webhook: 3,
  CustomizationFile: 4,
  Profile: 5,
  Catalog: 6,
  Filter: 7,
  UserDefinedTable: 8,

  toString: function (enumValue) {
    switch (enumValue) {
      case this.None:
        return "None";
      case this.Profile:
        return "Profile";
      case this.GenericList:
        return "GenericList";
      case this.CustomizationFile:
        return "CustomizationFile";
      case this.ActivityTypeDefinition:
        return "ActivityTypeDefinition";
      case this.Catalog:
        return "Catalog";
      case this.Filter:
        return "Filter";
      case this.UserDefinedTable:
        return "UserDefinedTable";
      case this.Webhook:
        return "Webhook";
    }
  },

  values: function () {
    return Object.keys(this).filter((k) => {
      return typeof this[k] !== "function";
    });
  },
});
