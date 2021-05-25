// @remove-file-on-eject
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
 'use strict';

 // Makes the script crash on unhandled rejections instead of silently
 // ignoring them. In the future, promise rejections that are not handled will
 // terminate the Node.js process with a non-zero exit code.
 process.on('unhandledRejection', err => {
   throw err;
 });
 
 const fs = require('fs-extra');
 const path = require('path');
 const chalk = require('react-dev-utils/chalk');
 const execSync = require('child_process').execSync;
 const spawn = require('react-dev-utils/crossSpawn');
 const { defaultBrowsers } = require('react-dev-utils/browsersHelper');
 const os = require('os');
 const verifyTypeScriptSetup = require('./utils/verifyTypeScriptSetup');
 
 function isInGitRepository() {
   try {
     execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
     return true;
   } catch (e) {
     return false;
   }
 }
 
 function isInMercurialRepository() {
   try {
     execSync('hg --cwd . root', { stdio: 'ignore' });
     return true;
   } catch (e) {
     return false;
   }
 }
 
 function tryGitInit() {
   try {
     execSync('git --version', { stdio: 'ignore' });
     if (isInGitRepository() || isInMercurialRepository()) {
       return false;
     }
 
     execSync('git init', { stdio: 'ignore' });
     return true;
   } catch (e) {
     console.warn('Git repo not initialized', e);
     return false;
   }
 }
 
 function tryGitCommit(appPath) {
   try {
     execSync('git add -A', { stdio: 'ignore' });
     execSync('git commit -m "Initialize project using Create React App"', {
       stdio: 'ignore',
     });
     return true;
   } catch (e) {
     // We couldn't commit in already initialized git repo,
     // maybe the commit author config is not set.
     // In the future, we might supply our own committer
     // like Ember CLI does, but for now, let's just
     // remove the Git files to avoid a half-done state.
     console.warn('Git commit not created', e);
     console.warn('Removing .git directory...');
     try {
       // unlinkSync() doesn't work on directories.
       fs.removeSync(path.join(appPath, '.git'));
     } catch (removeErr) {
       // Ignore.
     }
     return false;
   }
 }
 
 module.exports = function (
   appPath,
   appName,
   verbose,
   originalDirectory,
   templateName
 ) {
   const appPackage = require(path.join(appPath, 'package.json'));
   const useYarn = fs.existsSync(path.join(appPath, 'yarn.lock'));
 
   if (!templateName) {
     console.log('');
     console.error(
       `A template was not provided. This is likely because you're using an outdated version of ${chalk.cyan(
         'create-react-app'
       )}.`
     );
     console.error(
       `Please note that global installs of ${chalk.cyan(
         'create-react-app'
       )} are no longer supported.`
     );
     console.error(
       `You can fix this by running ${chalk.cyan(
         'npm uninstall -g create-react-app'
       )} or ${chalk.cyan(
         'yarn global remove create-react-app'
       )} before using ${chalk.cyan('create-react-app')} again.`
     );
     return;
   }
 
   const templatePath = path.dirname(
     require.resolve(`${templateName}/package.json`, { paths: [appPath] })
   );
 
   const templateJsonPath = path.join(templatePath, 'template.json');
 
   let templateJson = {};
   if (fs.existsSync(templateJsonPath)) {
     templateJson = require(templateJsonPath);
   }
 
   const templatePackage = templateJson.package || {};
 
   // TODO: Deprecate support for root-level `dependencies` and `scripts` in v5.
   // These should now be set under the `package` key.
   if (templateJson.dependencies || templateJson.scripts) {
     console.log();
     console.log(
       chalk.yellow(
         'Root-level `dependencies` and `scripts` keys in `template.json` are deprecated.\n' +
           'This template should be updated to use the new `package` key.'
       )
     );
     console.log('For more information, visit https://cra.link/templates');
   }
   if (templateJson.dependencies) {
     templatePackage.dependencies = templateJson.dependencies;
   }
   if (templateJson.scripts) {
     templatePackage.scripts = templateJson.scripts;
   }
 
   // Keys to ignore in templatePackage
   const templatePackageBlacklist = [
     'name',
     'version',
     'description',
     'keywords',
     'bugs',
     'license',
     'author',
     'contributors',
     'files',
     'browser',
     'bin',
     'man',
     'directories',
     'repository',
     'peerDependencies',
     'bundledDependencies',
     'optionalDependencies',
     'engineStrict',
     'os',
     'cpu',
     'preferGlobal',
     'private',
     'publishConfig',
   ];
 
   // Keys from templatePackage that will be merged with appPackage
   const templatePackageToMerge = ['dependencies', 'scripts'];
 
   // Keys from templatePackage that will be added to appPackage,
   // replacing any existing entries.
   const templatePackageToReplace = Object.keys(templatePackage).filter(key => {
     return (
       !templatePackageBlacklist.includes(key) &&
       !templatePackageToMerge.includes(key)
     );
   });
 
   // Copy over some of the devDependencies
   appPackage.dependencies = appPackage.dependencies || {};
 
   // Setup the script rules
   const templateScripts = templatePackage.scripts || {};
   appPackage.scripts = Object.assign(
     {
       start: 'react-scripts start',
       build: 'react-scripts build',
       test: 'react-scripts test',
       eject: 'react-scripts eject',
     },
     templateScripts
   );
 
   // Update scripts for Yarn users
   if (useYarn) {
     appPackage.scripts = Object.entries(appPackage.scripts).reduce(
       (acc, [key, value]) => ({
         ...acc,
         [key]: value.replace(/(npm run |npm )/, 'yarn '),
       }),
       {}
     );
   }
 
   // Setup the eslint config
   appPackage.eslintConfig = {
     extends: 'react-app',
   };
 
   // Setup the browsers list
   appPackage.browserslist = defaultBrowsers;
 
   // Add templatePackage keys/values to appPackage, replacing existing entries
   templatePackageToReplace.forEach(key => {
     appPackage[key] = templatePackage[key];
   });
 
   fs.writeFileSync(
     path.join(appPath, 'package.json'),
     JSON.stringify(appPackage, null, 2) + os.EOL
   );
 
   const readmeExists = fs.existsSync(path.join(appPath, 'README.md'));
   if (readmeExists) {
     fs.renameSync(
       path.join(appPath, 'README.md'),
       path.join(appPath, 'README.old.md')
     );
   }
 
   // Copy the files for the user
   const templateDir = path.join(templatePath, 'template');
   if (fs.existsSync(templateDir)) {
     fs.copySync(templateDir, appPath);
   } else {
     console.error(
       `Could not locate supplied template: ${chalk.green(templateDir)}`
     );
     return;
   }
 
   // modifies README.md commands based on user used package manager.
   if (useYarn) {
     try {
       const readme = fs.readFileSync(path.join(appPath, 'README.md'), 'utf8');
       fs.writeFileSync(
         path.join(appPath, 'README.md'),
         readme.replace(/(npm run |npm )/g, 'yarn '),
         'utf8'
       );
     } catch (err) {
       // Silencing the error. As it fall backs to using default npm commands.
     }
   }
 
   const gitignoreExists = fs.existsSync(path.join(appPath, '.gitignore'));
   if (gitignoreExists) {
     // Append if there's already a `.gitignore` file there
     const data = fs.readFileSync(path.join(appPath, 'gitignore'));
     fs.appendFileSync(path.join(appPath, '.gitignore'), data);
     fs.unlinkSync(path.join(appPath, 'gitignore'));
   } else {
     // Rename gitignore after the fact to prevent npm from renaming it to .npmignore
     // See: https://github.com/npm/npm/issues/1862
     fs.moveSync(
       path.join(appPath, 'gitignore'),
       path.join(appPath, '.gitignore'),
       []
     );
   }
 
   // Initialize git repo
   let initializedGit = false;
 
   if (tryGitInit()) {
     initializedGit = true;
     console.log();
     console.log('Initialized a git repository.');
   }
 
   let command;
   let remove;
   let args;
 
   if (useYarn) {
     command = 'yarnpkg';
     remove = 'remove';
     args = ['add'];
   } else {
     command = 'npm';
     remove = 'uninstall';
     args = ['install', '--save', verbose && '--verbose'].filter(e => e);
   }
 
   // Install additional template dependencies, if present.
   const dependenciesToInstall = Object.entries({
     ...templatePackage.dependencies,
     ...templatePackage.devDependencies,
   });
   if (dependenciesToInstall.length) {
     args = args.concat(
       dependenciesToInstall.map(([dependency, version]) => {
         return `${dependency}@${version}`;
       })
     );
   }
 
   // Install react and react-dom for backward compatibility with old CRA cli
   // which doesn't install react and react-dom along with react-scripts
   if (!isReactInstalled(appPackage)) {
     args = args.concat(['react', 'react-dom']);
   }
 
   // Install template dependencies, and react and react-dom if missing.
   if ((!isReactInstalled(appPackage) || templateName) && args.length > 1) {
     console.log();
     console.log(`Installing template dependencies using ${command}...`);
 console.log(args);
     const proc = spawn.sync(command, args, { stdio: 'inherit' });
     if (proc.status !== 0) {
       console.error(`\`${command} ${args.join(' ')}\` failed`);
       return;
     }
   }
 
   if (args.find(arg => arg.includes('typescript'))) {
     console.log();
     verifyTypeScriptSetup();
   }
 
   // Remove template
   console.log(`Removing template package using ${command}...`);
   console.log();
 
   const proc = spawn.sync(command, [remove, templateName], {
     stdio: 'inherit',
   });
   if (proc.status !== 0) {
     console.error(`\`${command} ${args.join(' ')}\` failed`);
     return;
   }
 
   // Create git commit if git repo was initialized
   if (initializedGit && tryGitCommit(appPath)) {
     console.log();
     console.log('Created git commit.');
   }
 
   // Display the most elegant way to cd.
   // This needs to handle an undefined originalDirectory for
   // backward compatibility with old global-cli's.
   let cdpath;
   if (originalDirectory && path.join(originalDirectory, appName) === appPath) {
     cdpath = appName;
   } else {
     cdpath = appPath;
   }
 
   // Change displayed command to yarn instead of yarnpkg
   const displayedCommand = useYarn ? 'yarn' : 'npm';
 
   console.log();
   console.log(`Success! Created ${appName} at ${appPath}`);
   console.log('Inside that directory, you can run several commands:');
   console.log();
   console.log(chalk.cyan(`  ${displayedCommand} start`));
   console.log('    Starts the development server.');
   console.log();
   console.log(
     chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}build`)
   );
   console.log('    Bundles the app into static files for production.');
   console.log();
   console.log(chalk.cyan(`  ${displayedCommand} test`));
   console.log('    Starts the test runner.');
   console.log();
   console.log(
     chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}eject`)
   );
   console.log(
     '    Removes this tool and copies build dependencies, configuration files'
   );
   console.log(
     '    and scripts into the app directory. If you do this, you can’t go back!'
   );
   console.log();
   console.log('We suggest that you begin by typing:');
   console.log();
   console.log(chalk.cyan('  cd'), cdpath);
   console.log(`  ${chalk.cyan(`${displayedCommand} start`)}`);
   if (readmeExists) {
     console.log();
     console.log(
       chalk.yellow(
         'You had a `README.md` file, we renamed it to `README.old.md`'
       )
     );
   }
   console.log();
   console.log('Happy hacking!');

   console.log(
    chalk.magenta('==============================','CUSTOM REACT SCRIPTS', '=========================')
  );

  console.log(chalk.green('Setting up monorepo'));
  // +++ moving generated react app and clean up
  console.log('\tMoving React client to /client');
  
  const filesAndDirsToMove = [ 'package.json'];
  const filesAndDirsToRemove = ['node_modules', useYarn? 'yarn.lock' : 'package-lock.json']
  
  const clientDirectory = path.join(appPath, 'client');

  if(!fs.existsSync(clientDirectory)){
    console.error('client/ forder not found. Maybe you are not using the correct template?');

    return;
  }
  
  for(const name of filesAndDirsToMove){
    fs.moveSync(path.join(appPath, name), path.join(clientDirectory, name));
  }

  for(const name of filesAndDirsToRemove){
    fs.removeSync(path.join(appPath, name));
  }

  // +++ +++ +++ ++ +++

  //+++ setting up packages defined in template.json
  const packages = templateJson.packages;
  const packageNames = Object.keys(packages);

  packageNames.forEach(packageName => {
    console.log(chalk.green(`setting up package ${packageName}`));
    const dependencies = packages[packageName].dependencies || {};
    const devDependecies = packages[packageName].devDependencies || {};
    const packageRoot = path.join(appPath, packageName);
    const packageJsonPath = path.join(packageRoot, 'package.json');
    const gitignorePath = path.join(packageRoot, 'gitignore');
    let packageJson;
    if(fs.existsSync(packageJsonPath)){
      packageJson = require(packageJsonPath);
      packageJson.name = packageName;
    }else{
      console.log('\tNo package.json found ...generating one');
      packageJson = {
        name: packageName,
        version: '0.1.0',
        private: true,
        scripts: {}
      }
    }
    if(fs.exists(gitignorePath)){
      console.log('\tgitignore file found ...renaming to .gitignore');
      fs.moveSync(gitignorePath, path.join(packageRoot, '.gitignore'));
    }
    if(!packageJson.dependencies) packageJson.dependencies = {};
    if(!packageJson.devDependecies) packageJson.devDependecies = {};
    Object.assign(packageJson.dependencies, dependencies);
    Object.assign(packageJson.devDependecies, devDependecies);
    fs.writeFileSync(
      packageJsonPath, 
      JSON.stringify(packageJson, null, 2) + os.EOL
      );
  })

  //+++ setting up orchestration tools
  //+++ installing dev dependencies from here on
  if (useYarn) {
    args = ['add', '--dev'];
  } else {
    args = ['install', '--save-dev', verbose && '--verbose'].filter(e => e);
  }

  console.log(chalk.green('Setting up orchestration tools...'));

  //+++ creating root package.json
  const lernaScripts = ['bootstrap'];
  const lernaRunScripts = ['start'];
  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true,
    scripts: {}
  };
  lernaScripts.forEach(name => packageJson.scripts[name] = `lerna ${name}`);
  lernaRunScripts.forEach(name => packageJson.scripts[name] = `lerna run ${name}`);
  fs.writeFileSync(
    path.join(appPath, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL
  );

  //+++ setup lerna
  let ownProc = spawn.sync(command, args.concat('lerna'), { stdio: 'inherit' });
    if (ownProc.status !== 0) {
      console.error(`\`${command} ${args.concat('lerna').join(' ')}\` failed`);
      return;
    }

  const lernaJSON = {
    version: "0.1.0",
    packages: packageNames
  };

  fs.writeFileSync(path.join(appPath, 'lerna.json'), JSON.stringify(lernaJSON, null, 2) + os.EOL);
  console.log(chalk.green('bootstrapping packages with lerna'));
  ownProc = spawn.sync(command, ['run', 'bootstrap'], { stdio: 'inherit' });
  if (ownProc.status !== 0) {
    console.error(`\`${command} ${args.concat('lerna').join(' ')}\` failed`);
    return;
  }

  console.log(chalk.green('Monorepo setup complete!'));
 };
 
 function isReactInstalled(appPackage) {
   const dependencies = appPackage.dependencies || {};
 
   return (
     typeof dependencies.react !== 'undefined' &&
     typeof dependencies['react-dom'] !== 'undefined'
   );
 }
