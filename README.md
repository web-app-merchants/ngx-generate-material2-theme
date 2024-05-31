# Ngx Generate Material 2 Theme

This library was generated with [Nx](https://nx.dev).

This Angular schematic generates an angular material 2 theme from primary and accent hex color values, a dark mode is also generated.

Use it after adding @angular/material with schematics.

[For material 3, click here](https://material.angular.io/guide/theming#custom-theme)

### Usage

#### _1. Install @angular/material_

```sh
ng add @angular/material --projectName app-name --animations enabled --theme custom --typography
```

#### _2. Run the schematic to generate a custom theme (replace color values with your own)_

```sh
ng add @ngwam/ngx-generate-material2-theme --projectName app-name --primaryColor '#702963' --accentColor '#FFC0CB'
```

#### N.B. Theme switcher

You will have to implement the theme switching service on your own.

```ts
// Here is an example snippet for changing the data-theme data attribute

const document = inject(Document);
document.body.setAttribute('data-theme-mode', 'dark');
```

### Testing

To test locally, install `@angular-devkit/schematics-cli` globally and use the `schematics` command line tool. That tool acts the same as the `generate` command of the Angular CLI, but also has a debug mode.

Check the documentation with

```bash
schematics --help
```

### Unit Testing

`npm run test` will run the unit tests, using Jasmine as a runner and test framework.

### Publishing

To publish, simply do:

```bash
npm run build
npm publish
```
