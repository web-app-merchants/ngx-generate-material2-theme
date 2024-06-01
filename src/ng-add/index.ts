
import {chain, Rule, SchematicContext, Tree, SchematicsException} from "@angular-devkit/schematics";
import {NgxMaterialHue, NgxThemeTemplateMap, Schema} from "./schema.interface";
import {getWorkspace} from '@schematics/angular/utility/workspace';
import {getProjectFromWorkspace} from '@angular/cdk/schematics';
import {ProjectType} from "@schematics/angular/utility/workspace-models";
import {ProjectDefinition} from '@angular-devkit/core/src/workspace';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import * as tinycolor from 'tinycolor2';


export default function (options: Schema): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(tree);
    const {projectName, primaryColor, accentColor} = options;
    const hexRegex = '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$';

    if (projectName) {
    const project = getProjectFromWorkspace(workspace, projectName);

    const isPrimaryColorValidRegex = primaryColor.match(hexRegex);
    const isAccentColorValidRegex = accentColor.match(hexRegex);


      if (isPrimaryColorValidRegex && isAccentColorValidRegex) {

        context.logger.info(`⌛ Generating Theme`);

        if (project.extensions.projectType === ProjectType.Application) {
          return chain([
            addPackagesToPackageJson(),
            addThemeToAppStyles({projectName, primaryColor, accentColor}, project),
          ]);
        } else {
          if (!isPrimaryColorValidRegex) {
            context.logger.error(`✗ Primary colour is invalid format: "${primaryColor}"`);
            return;
          }

          if (!isAccentColorValidRegex) {
            context.logger.error(`✗ Accent colour is invalid format: "${accentColor}"`);
            return;
          }
          return;
        }

      }
    } else {
      context.logger.error('✗ No project name provided');
      return;
    }
  };
}

function addPackagesToPackageJson(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const pkgPath = '/package.json';
    const buffer = tree.read(pkgPath);

    if (!buffer) {
      throw new SchematicsException('Could not find package.json');
    }

    const pkg = JSON.parse(buffer.toString());

    if (!pkg.dependencies) {
      pkg.dependencies = {};
    }

    pkg.dependencies['tinycolor2'] = '1.6.0';

    tree.overwrite(pkgPath, JSON.stringify(pkg, null, 2));

    context.logger.info(`✓ tinycolor2 Installed`);
    context.addTask(new NodePackageInstallTask());
    return tree;
  };
}

/** Add pre-built styles to the main project style file. */
function addThemeToAppStyles(options: Schema, project: ProjectDefinition): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const sourceRoot = project.sourceRoot;
    const themesFolder = `${sourceRoot}/assets/themes`;
    const globalStyleFile = `${sourceRoot}/styles.scss`;
    const indexHtmlFile = `${sourceRoot}/index.html`;
    const {projectName, primaryColor, accentColor} = options;
    const primaryTinyColor = new tinycolor(primaryColor);
    const accentTinyColor = new tinycolor(accentColor);

    const primaryHues = generateHues(primaryTinyColor);
    const accentHues = generateHues(accentTinyColor);

    const themeTemplateMap = generateThemeTemplateMap(primaryHues, accentHues);

    const themeTemplate = generateThemeTemplate(themeTemplateMap);
    const themeFilePath = `${themesFolder}/${projectName}-theme.scss`;

    if (tree.exists(themeFilePath)) {
      tree.overwrite(themeFilePath, themeTemplate);
    } else {
      tree.create(themeFilePath, '');
      tree.overwrite(themeFilePath, themeTemplate);
    }

    const globalStyleFileBuffer = tree.read(globalStyleFile);

    if (globalStyleFileBuffer) {
      let globalStyleFileContents = globalStyleFileBuffer.toString();

      if (globalStyleFileContents) {
        const primaryThemeStartPosition = globalStyleFileContents.indexOf(`$${projectName}-primary:`);
        const primaryThemeEndPosition = globalStyleFileContents.indexOf(';', primaryThemeStartPosition) + 1;
        const primaryThemeLine = globalStyleFileContents.substring(primaryThemeStartPosition, primaryThemeEndPosition);
        const darkThemeMarker = '// DARK THEME START';

        const accentThemeStartPosition = globalStyleFileContents.indexOf(`$${projectName}-accent:`);
        const accentThemeEndPosition = globalStyleFileContents.indexOf(';', accentThemeStartPosition) + 1;
        const accentThemeLine = globalStyleFileContents.substring(accentThemeStartPosition, accentThemeEndPosition);

        const importThemeFileLine = `@use './assets/themes/${projectName}-theme' as customTheme;`;
        const newPrimaryThemeLine = `$${projectName}-primary: mat.define-palette(customTheme.$primary-palette);`;
        const newAccentThemeLine = `$${projectName}-accent: mat.define-palette(customTheme.$accent-palette);`;

        if (!(globalStyleFileContents.indexOf(importThemeFileLine) > -1)) {
          globalStyleFileContents = globalStyleFileContents.replace(`@use '@angular/material' as mat;`, `@use '@angular/material' as mat; \n${importThemeFileLine}`);
        }

        if (globalStyleFileContents.indexOf(primaryThemeLine) > -1) {
          globalStyleFileContents = globalStyleFileContents.replace(primaryThemeLine, newPrimaryThemeLine);
        }

        if (globalStyleFileContents.indexOf(accentThemeLine) > -1) {
          globalStyleFileContents = globalStyleFileContents.replace(accentThemeLine, newAccentThemeLine);
        }

        if (!(globalStyleFileContents.indexOf(darkThemeMarker) > -1)) {
          globalStyleFileContents = globalStyleFileContents.concat(generateDarkTheme(projectName, primaryColor, accentColor));
        }

        tree.overwrite(globalStyleFile, globalStyleFileContents);
      }
    }

    const indexHtmlFileBuffer = tree.read(indexHtmlFile);

    if (indexHtmlFileBuffer) {
      let indexHtmlFileContents = indexHtmlFileBuffer.toString();

      if (indexHtmlFileContents) {
        const matAppBackgroundClass = 'mat-app-background'
        const darkThemeClass = 'dark';

        const isMatAppBackgroundClassFound = indexHtmlFileContents.indexOf(matAppBackgroundClass) > -1;
        const isDarkThemeClassFound = indexHtmlFileContents.indexOf(darkThemeClass) > -1;

        if (!isMatAppBackgroundClassFound && !isDarkThemeClassFound) {

          const openingBodyTagClassStart = indexHtmlFileContents.indexOf('<body');
          const openingBodyTagClassEnd = indexHtmlFileContents.indexOf('>', openingBodyTagClassStart) + 1;
          const bodyTagClassLine = indexHtmlFileContents.substring(openingBodyTagClassStart, openingBodyTagClassEnd);

          if (bodyTagClassLine.indexOf('class') > -1) {
            const newBodyTagLine = bodyTagClassLine.replace('class="', `class="mat-app-background `);
            indexHtmlFileContents = indexHtmlFileContents.replace(bodyTagClassLine, newBodyTagLine);
          } else {
            const newBodyTagLine = bodyTagClassLine.replace('>', ` class="mat-app-background">`);
            indexHtmlFileContents = indexHtmlFileContents.replace(bodyTagClassLine, newBodyTagLine);
          }

          const openingBodyTagDataThemeStart = indexHtmlFileContents.indexOf('<body');
          const openingBodyTagDataThemeEnd = indexHtmlFileContents.indexOf('>', openingBodyTagDataThemeStart) + 1;
          const bodyTagDataThemeLine = indexHtmlFileContents.substring(openingBodyTagDataThemeStart, openingBodyTagDataThemeEnd);

          const newBodyTagLine = bodyTagDataThemeLine.replace('>', ` data-theme-mode="dark">`);
          indexHtmlFileContents = indexHtmlFileContents.replace(bodyTagDataThemeLine, newBodyTagLine);

          tree.overwrite(indexHtmlFile, indexHtmlFileContents);
          context.logger.info(`☽ Dark Mode Enabled: change to data-theme-mode="light" in body tag to disable`);
        }
      }
    }

    context.logger.info(`✓ ${themesFolder}/${projectName}-theme.scss`);

    context.logger.info(`★ Finished`);
    return;
  };
}

function generateHues(color: tinycolor.Instance): NgxMaterialHue[] {
  const baseLight = new tinycolor('#ffffff');
  const baseDark = multiply(color, color);
  const baseTetrad = color.tetrad();

  baseTetrad[0].getOriginalInput();

  return [
    toHexColor('50', tinycolor.mix(baseLight, color, 12)),
    toHexColor('100', tinycolor.mix(baseLight, color, 30)),
    toHexColor('200', tinycolor.mix(baseLight, color, 50)),
    toHexColor('300', tinycolor.mix(baseLight, color, 70)),
    toHexColor('400', tinycolor.mix(baseLight, color, 85)),
    toHexColor('500', tinycolor.mix(baseDark, color, 100)),
    toHexColor('600', tinycolor.mix(baseDark, color, 87)),
    toHexColor('700', tinycolor.mix(baseDark, color, 70)),
    toHexColor('800', tinycolor.mix(baseDark, color, 54)),
    toHexColor('900', tinycolor.mix(baseDark, color, 25)),
    toHexColor('A100', tinycolor.mix(baseTetrad[3].getOriginalInput(), color, 15).saturate(80).lighten(65)),
    toHexColor('A200', tinycolor.mix(baseTetrad[3].getOriginalInput(), color, 15).saturate(80).lighten(55)),
    toHexColor('A400', tinycolor.mix(baseTetrad[3].getOriginalInput(), color, 15).saturate(100).lighten(45)),
    toHexColor('A700', tinycolor.mix(baseTetrad[3].getOriginalInput(), color, 15).saturate(100).lighten(40))
  ];
}

function toHexColor(name: string, color: tinycolor.Instance): NgxMaterialHue {
  return {
    Name: name,
    Color: color.toHex8String(),
    ContrastColor: color.isLight() ? '#000000' : '#ffffff'
  };
}

function multiply(color1: tinycolor.Instance, color2: tinycolor.Instance): tinycolor.Instance {
  return new tinycolor({
    r: Math.floor(color1.toRgb().r * color2.toRgb().r / 255),
    g: Math.floor(color1.toRgb().g * color2.toRgb().g / 255),
    b: Math.floor(color1.toRgb().b * color2.toRgb().b / 255)
  });
}

function getContrastColorVariable(color: string) {
  return color === '#000000' ? '$dark-primary-text' : '$light-primary-text';
}

function generateThemeTemplateMap(primaryHues: NgxMaterialHue[], accentHues: NgxMaterialHue[]) {
  const themeTemplateMap: NgxThemeTemplateMap = {
    primary: {},
    accent: {}
  }

  primaryHues.forEach(primaryHue => {
    themeTemplateMap.primary[primaryHue.Name] = primaryHue;
  });

  accentHues.forEach(accentHue => {
    themeTemplateMap.accent[accentHue.Name] = accentHue;
  });

  return themeTemplateMap;
}

function generateThemeTemplate(themeTemplateMap: NgxThemeTemplateMap) {
  return `@use 'sass:map';

$dark-primary-text: rgba(black, 0.87);
$dark-accent-text: rgba(black, 0.54);
$dark-disabled-text: rgba(black, 0.38);
$dark-dividers: rgba(black, 0.12);
$dark-focused: rgba(black, 0.12);
$light-primary-text: white;
$light-accent-text: rgba(white, 0.7);
$light-disabled-text: rgba(white, 0.5);
$light-dividers: rgba(white, 0.12);
$light-focused: rgba(white, 0.12);

// Custom Theme Start.
$primary-palette: (
  50: ${themeTemplateMap.primary['50'].Color},
  100: ${themeTemplateMap.primary['100'].Color},
  200: ${themeTemplateMap.primary['200'].Color},
  300: ${themeTemplateMap.primary['300'].Color},
  400: ${themeTemplateMap.primary['400'].Color},
  500: ${themeTemplateMap.primary['500'].Color},
  600: ${themeTemplateMap.primary['600'].Color},
  700: ${themeTemplateMap.primary['700'].Color},
  800: ${themeTemplateMap.primary['800'].Color},
  900: ${themeTemplateMap.primary['900'].Color},
  A100: ${themeTemplateMap.primary['A100'].Color},
  A200: ${themeTemplateMap.primary['A200'].Color},
  A400: ${themeTemplateMap.primary['A400'].Color},
  A700: ${themeTemplateMap.primary['A700'].Color},
  contrast: (
    50: ${getContrastColorVariable(themeTemplateMap.primary['50'].ContrastColor)},
    100: ${getContrastColorVariable(themeTemplateMap.primary['100'].ContrastColor)},
    200: ${getContrastColorVariable(themeTemplateMap.primary['200'].ContrastColor)},
    300: ${getContrastColorVariable(themeTemplateMap.primary['300'].ContrastColor)},
    400: ${getContrastColorVariable(themeTemplateMap.primary['400'].ContrastColor)},
    500: ${getContrastColorVariable(themeTemplateMap.primary['500'].ContrastColor)},
    600: ${getContrastColorVariable(themeTemplateMap.primary['600'].ContrastColor)},
    700: ${getContrastColorVariable(themeTemplateMap.primary['700'].ContrastColor)},
    800: ${getContrastColorVariable(themeTemplateMap.primary['800'].ContrastColor)},
    900: ${getContrastColorVariable(themeTemplateMap.primary['900'].ContrastColor)},
    A100: ${getContrastColorVariable(themeTemplateMap.primary['A100'].ContrastColor)},
    A200: ${getContrastColorVariable(themeTemplateMap.primary['A200'].ContrastColor)},
    A400: ${getContrastColorVariable(themeTemplateMap.primary['A400'].ContrastColor)},
    A700: ${getContrastColorVariable(themeTemplateMap.primary['A700'].ContrastColor)},
  )
);

$accent-palette: (
  50: ${themeTemplateMap.accent['50'].Color},
  100: ${themeTemplateMap.accent['100'].Color},
  200: ${themeTemplateMap.accent['200'].Color},
  300: ${themeTemplateMap.accent['300'].Color},
  400: ${themeTemplateMap.accent['400'].Color},
  500: ${themeTemplateMap.accent['500'].Color},
  600: ${themeTemplateMap.accent['600'].Color},
  700: ${themeTemplateMap.accent['700'].Color},
  800: ${themeTemplateMap.accent['800'].Color},
  900: ${themeTemplateMap.accent['900'].Color},
  A100: ${themeTemplateMap.accent['A100'].Color},
  A200: ${themeTemplateMap.accent['A200'].Color},
  A400: ${themeTemplateMap.accent['A400'].Color},
  A700: ${themeTemplateMap.accent['A700'].Color},
  contrast: (
    50: ${getContrastColorVariable(themeTemplateMap.accent['50'].ContrastColor)},
    100: ${getContrastColorVariable(themeTemplateMap.accent['100'].ContrastColor)},
    200: ${getContrastColorVariable(themeTemplateMap.accent['200'].ContrastColor)},
    300: ${getContrastColorVariable(themeTemplateMap.accent['300'].ContrastColor)},
    400: ${getContrastColorVariable(themeTemplateMap.accent['400'].ContrastColor)},
    500: ${getContrastColorVariable(themeTemplateMap.accent['500'].ContrastColor)},
    600: ${getContrastColorVariable(themeTemplateMap.accent['600'].ContrastColor)},
    700: ${getContrastColorVariable(themeTemplateMap.accent['700'].ContrastColor)},
    800: ${getContrastColorVariable(themeTemplateMap.accent['800'].ContrastColor)},
    900: ${getContrastColorVariable(themeTemplateMap.accent['900'].ContrastColor)},
    A100: ${getContrastColorVariable(themeTemplateMap.accent['A100'].ContrastColor)},
    A200: ${getContrastColorVariable(themeTemplateMap.accent['A200'].ContrastColor)},
    A400: ${getContrastColorVariable(themeTemplateMap.accent['A400'].ContrastColor)},
    A700: ${getContrastColorVariable(themeTemplateMap.accent['A700'].ContrastColor)},
  )
);
// Custom Theme End.

$grey-palette: (
  50: #fafafa,
  100: #f5f5f5,
  200: #eeeeee,
  300: #e0e0e0,
  400: #bdbdbd,
  500: #9e9e9e,
  600: #757575,
  700: #616161,
  800: #424242,
  900: #212121,
  A100: #ffffff,
  A200: #eeeeee,
  A400: #bdbdbd,
  A700: #616161,
  contrast: (
    50: $dark-primary-text,
    100: $dark-primary-text,
    200: $dark-primary-text,
    300: $dark-primary-text,
    400: $dark-primary-text,
    500: $dark-primary-text,
    600: $light-primary-text,
    700: $light-primary-text,
    800: $light-primary-text,
    900: $light-primary-text,
    A100: $dark-primary-text,
    A200: $dark-primary-text,
    A400: $dark-primary-text,
    A700: $light-primary-text,
  )
);

// Alias for alternate spelling.
$gray-palette: $grey-palette;

$blue-grey-palette: (
  50: #eceff1,
  100: #cfd8dc,
  200: #b0bec5,
  300: #90a4ae,
  400: #78909c,
  500: #607d8b,
  600: #546e7a,
  700: #455a64,
  800: #37474f,
  900: #263238,
  A100: #cfd8dc,
  A200: #b0bec5,
  A400: #78909c,
  A700: #455a64,
  contrast: (
    50: $dark-primary-text,
    100: $dark-primary-text,
    200: $dark-primary-text,
    300: $dark-primary-text,
    400: $light-primary-text,
    500: $light-primary-text,
    600: $light-primary-text,
    700: $light-primary-text,
    800: $light-primary-text,
    900: $light-primary-text,
    A100: $dark-primary-text,
    A200: $dark-primary-text,
    A400: $light-primary-text,
    A700: $light-primary-text,
  )
);

// Alias for alternate spelling.
$blue-gray-palette: $blue-grey-palette;

// Background palette for light themes.
$light-theme-background-palette: (
  status-bar: map.get($grey-palette, 300),
  app-bar:    map.get($grey-palette, 100),
  background: map.get($grey-palette, 50),
  hover:      rgba(black, 0.04), // TODO(kara): check style with Material Design UX
  card:       white,
  dialog:     white,
  disabled-button: rgba(black, 0.12),
  raised-button: white,
  focused-button: $dark-focused,
  selected-button: map.get($grey-palette, 300),
  selected-disabled-button: map.get($grey-palette, 400),
  disabled-button-toggle: map.get($grey-palette, 200),
  unselected-chip: map.get($grey-palette, 300),
  disabled-list-option: map.get($grey-palette, 200),
  tooltip: map.get($grey-palette, 700),
);

// Background palette for dark themes.
$dark-theme-background-palette: (
  status-bar: black,
  app-bar:    map.get($grey-palette, 900),
  background: #303030,
  hover:      rgba(white, 0.04), // TODO(kara): check style with Material Design UX
  card:       map.get($grey-palette, 800),
  dialog:     map.get($grey-palette, 800),
  disabled-button: rgba(white, 0.12),
  raised-button: map.get($grey-palette, 800),
  focused-button: $light-focused,
  selected-button: map.get($grey-palette, 900),
  selected-disabled-button: map.get($grey-palette, 800),
  disabled-button-toggle: black,
  unselected-chip: map.get($grey-palette, 700),
  disabled-list-option: rgba(white, 0.12),
  tooltip: map.get($grey-palette, 700),
);

// Foreground palette for light themes.
$light-theme-foreground-palette: (
  base:              black,
  divider:           $dark-dividers,
  dividers:          $dark-dividers,
  disabled:          $dark-disabled-text,
  disabled-button:   rgba(black, 0.26),
  disabled-text:     $dark-disabled-text,
  elevation:         black,
  hint-text:         $dark-disabled-text,
  accent-text:    $dark-accent-text,
  icon:              rgba(black, 0.54),
  icons:             rgba(black, 0.54),
  text:              rgba(black, 0.87),
  slider-min:        rgba(black, 0.87),
  slider-off:        rgba(black, 0.26),
  slider-off-active: rgba(black, 0.38),
);

// Foreground palette for dark themes.
$dark-theme-foreground-palette: (
  base:              white,
  divider:           $light-dividers,
  dividers:          $light-dividers,
  disabled:          $light-disabled-text,
  disabled-button:   rgba(white, 0.3),
  disabled-text:     $light-disabled-text,
  elevation:         black,
  hint-text:         $light-disabled-text,
  accent-text:    $light-accent-text,
  icon:              white,
  icons:             white,
  text:              white,
  slider-min:        white,
  slider-off:        rgba(white, 0.3),
  slider-off-active: rgba(white, 0.3),
);
  `;
}

function generateDarkTheme(projectName:string, primaryColor: string, accentColor: string) {
  return `\n:root {
  --primary: ${primaryColor};
  --accent: ${accentColor};
}

// DARK THEME START
$${projectName}-dark-primary: mat.define-palette(customTheme.$primary-palette);
$${projectName}-dark-accent: mat.define-palette(customTheme.$accent-palette);
$${projectName}-dark-warn: mat.define-palette(mat.$red-palette);
$${projectName}-dark-theme: mat.define-dark-theme(
    (
      color: (
        primary: $${projectName}-dark-primary,
        accent: $${projectName}-dark-accent,
        warn: $${projectName}-dark-warn,
      ),
    )
);

[data-theme-mode="dark"] {
  @include mat.all-component-colors($${projectName}-dark-theme);
}
// DARK THEME END`
}
