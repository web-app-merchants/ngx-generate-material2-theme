
import {Rule, SchematicContext, Tree} from "@angular-devkit/schematics";
import {Schema} from "./schema.interface";
import {NodePackageInstallTask, RunSchematicTask} from '@angular-devkit/schematics/tasks';
import {addPackageToPackageJson} from './package-config';

export default function (options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const {projectName} = options;

    if (projectName) {
      addPackageToPackageJson(host, 'tinycolor2', '1.6.0');

      const installTaskId = context.addTask(new NodePackageInstallTask());
      context.addTask(new RunSchematicTask('ng-add-setup-custom-theme', options), [installTaskId])
    } else {
      context.logger.error('✗ No project name provided');
      return;
    }
  };
}
