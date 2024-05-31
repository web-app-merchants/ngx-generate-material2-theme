export interface Schema {
  projectName: string;
  primaryColor: string;
  accentColor: string;
}

export interface NgxMaterialHue {
  Name: string;
  Color: string;
  ContrastColor: string;
}

export interface NgxThemeTemplateMap {
  primary: {[key: string]: NgxMaterialHue},
  accent: {[key: string]: NgxMaterialHue}
}
