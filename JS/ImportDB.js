const fs = require("fs-extra");
const path = require("path");
const misc = require ("./misc.js");
const os = require("os");

async function ImportDB (postdata) {
    /* user wants to import a DataBase */
    var fpath, Tmsg = '', Terror = '';

    /* remove any leading and following whitespace */
    postdata.dbin_loc = postdata.dbin_loc.trim();
    postdata.db_name = postdata.db_name.trim();
    postdata.user_dbid = postdata.user_dbid.trim();

    /* ensure path to location of data to import is absolute */
    if (path.isAbsolute(postdata.dbin_loc))
        fpath = path.normalize(postdata.dbin_loc);                 // absolute path
    else
        if (postdata.dbin_loc[0] == ".") {
            var sysloc = misc.ProcessDBSysInfo("SysLocation");
            fpath = path.join (sysloc, postdata.dbin_loc);         // relative path
        } else {
            var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
            fpath = path.join (homedir, postdata.dbin_loc);        // path base is home directory
        }
    postdata.dbin_loc = fpath;

    /* various validation checks for db-in location & contents */
    if (!fs.existsSync(postdata.dbin_loc)) {
        Terror += "The '" + postdata.dbin_loc + "' directory/folder does not exist.<br> <br>";
    } else {
        const stats = fs.statSync(postdata.dbin_loc);
        if (!stats.isDirectory()) {
            Terror += "'" + postdata.dbin_loc + "' exists but is not a directory/folder.<br> <br>";
        } else {
            try {
                fs.accessSync(path.normalize(postdata.dbin_loc), fs.constants.R_OK)
            }   
            catch(e) {
                Terror += "Directory permissions won't allow reading of files within '" + postdata.db_name + "'.<br> <br>";
            }       

            if (postdata.dbin_loc == misc.ProcessDBSysInfo ("SysLocation")) {
                Terror += "'" + postdata.dbin_loc + "' is the location of the MELGenUtils System. ";
                Terror += "The location of the data to import needs to be different.<br> <br>";
            } else {
                var cnt = 0, text = "TEXT", body = "BODY", btarr=[];;  
                var dir = path.normalize(postdata.dbin_loc);

                fs.readdirSync(dir).forEach(file => {
                    const Absolute = path.join(dir, file);
                    if (!fs.statSync(Absolute).isDirectory() && !fs.statSync(Absolute).isSymbolicLink())
                        if (text === file.substring(0,4).toUpperCase() || body === file.substring(0,4).toUpperCase()) {
                            btarr[cnt] = file;
                            cnt++;
                        }
                })
                if (cnt) {
                    Tmsg += cnt + " \"text\" or \"body\" ";
                    if (cnt == 1)
                        Tmsg += "file exists";
                    else
                        Tmsg += "files exist";
                    Tmsg += " in the directory/folder '" + dir + "'.<br> <br>";
                } else
                    Terror += "A \"text\" or \"body\" file (required) does not exist in the directory/folder '" + dir + "'.<br> <br>";

                /* sort array ascending by sequential number */
                if (btarr > 1)
                    btarr.sort((a,b) => a.substring(4) - b.substring(4));
                /* check for duplicate sequence numbers */
                for (cnt = 1; cnt < btarr.length; cnt++)
                    if (btarr[cnt].substring(4) == btarr[cnt - 1].substring[4])
                        Terror += "File '" + btarr[cnt - 1] + "' and file '" + btarr[cnt] + "' have identical sequence numbers. The sequence "
                                  "numbers on all \"body\" and \"text\" files must be unique.<br> <br>";

                var dir = path.normalize(postdata.dbin_loc), swtob = 0;
                var tob = "TABLEOFCONTENTS";

                fs.readdirSync(dir).forEach(file => {
                    if (tob === file.toUpperCase())
                        swtob = 1;
                })

                if (!swtob) {
                    Tmsg += "tableofcontents does not exist in the directory/folder '" + postdata.dbin_loc + "'; ";
                    Tmsg += "it will be auto-created." + os.EOL + os.EOL;
                }
                misc.GoThruDirectory(dir, 0);
            }
            if (postdata.hasOwnProperty('RemoveDir'))
                Tmsg += "The import directory/folder ('" + dir + "') and all it's contents will be removed only after a successful import." +
                         os.EOL + os.EOL;
        }
    }

    /* various validation checks for the DB output area location */
    misc.dirExist("DBs");  /* create directory/folder "DBs" if needed */
    var cntd = 0;
    fs.readdirSync("DBs").forEach(file => {
        const Absolute = path.join("DBs", file);
        if (fs.statSync(Absolute).isDirectory())
            if ((file.indexOf('BACKUP') === -1) && (file !== postdata.db_name))
                cntd++;
    })
    if (cntd > 19) {
        Terror += "20 DataBases have been imported. 20 is the maximum. To remove an imported DataBase and make room";
        Terror += "for the new DataBase use 'Import, Create or Remove a Family DataBase -> Deport a Family DataBase'.<br> <br>";
    } else {
        if (!fs.existsSync(path.join ("DBs", postdata.db_name))) {
            Tmsg += "The '" + postdata.db_name + "' directory/folder does not exist in DBs; it will be auto-created.<br> <br>";
        } else {
            const stats = fs.statSync(path.join ("DBs", postdata.db_name));
            if (!stats.isDirectory()) {
                Terror += "'" + postdata.db_name + "' exists but is not a directory/folder.<br> <br>";
            } else {
                try {
                    fs.accessSync(path.join ("DBs", postdata.db_name), fs.constants.W_OK)
                }
                catch(e) {
                    Terror += "Directory permissions won't allow writing to '" + postdata.db_name + "'.<br> <br>";
                }

                var numfiles = misc.GoThruDirectory(path.join ("DBs", postdata.db_name), 1);
                if (numfiles) {
                    Tmsg += "A Family DataBase named '" + postdata.db_name + "' already exists. The DataBase will be backed up ";
                    Tmsg += "before importing the new DataBase." + os.EOL + os.EOL;
                }
            }
        }
    }
    return [Terror, Tmsg];
}

function PerformImportDB (dbinfo) {
    const params = dbinfo.split(',');
    var dirin, dirout, action, fid, prot, impRes = 0;

    if (path.isAbsolute(params[0]))
        dirin = path.normalize(params[0]);                       // absolute path
    else
        if (params[0][0] == ".") {
            var sysloc = misc.ProcessDBSysInfo("SysLocation");
            dirin = path.join (sysloc, params[0]);               // relative path
        } else {
            var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
            dirin = path.join (homedir, params[0]);              // path base is home directory
        }

    dirout = path.join("DBs", params[1]);  /* relative location (from current working directory/folder) of directory where files will be placed */
    /* params[2]: db_actyes, activate imported DataBase upon a successful import; db_actno, do not activate imported DataBase */
    if (params[2] == "db_actyes")
        action = 1;
    else
        action = 0;
    fid = params[3];     /* focus ID in DB */
    /* params[4]: db_notprot, DataBase updateable; db_prot, DataBase not updateable */
    if (params[4] == "db_notprot")
        prot = 0;
    else
        prot = 1;

    /* create the output directory if it doesn't already exist;
       if it does exist and contains files move everything to a dirout.BACKUP directory */
    if (!fs.existsSync(dirout)) {
        try {
            fs.mkdirSync(dirout);
            fs.mkdirSync(path.join(dirout, 'PlainText'));
            misc.Logging("Directory/folder '" + dirout + "' and '" + dirout + "/PlainText' created.");
        }
        catch (err) {
            misc.Logging(err + "; problem creating directory/folder '" + dirout + "' and/or '" + dirout + "/PlainText'.");
            return -1;
        }
    } else {
        var contents='';
        contents = fs.readdirSync(dirout);
        if (contents !== '') {
            var cntd = 0;
            contents = fs.readdirSync("DBs");
            contents.forEach(file => {
                if (file.indexOf(params[1] + '.BACKUP') !== -1)
                    cntd++;
            })
            try {
                /* on Windows, renaming a directory which contains items doesn't seem to work; use copy & delete instead */
                fs.copySync(dirout, dirout + ".BACKUP" + cntd);
                fs.rmSync(dirout, { recursive: true, force: true });

                fs.mkdirSync(dirout);   /* since the original directory was moved (deleted actually), re-create it */
                fs.mkdirSync(path.join(dirout, 'PlainText'));
                misc.Logging ('"' + dirout + '" already exists. Backing it up before importing.');
                misc.Logging("Directory/folder '" + dirout + "' was backed up to '" + dirout + ".BACKUP" + cntd + "'.");
            }
            catch (err) {
                misc.Logging(err + "; problem backing up '" + params[1] + "'.");
                return -1;
            }
        } else {
            try {
                fs.mkdirSync(path.join(dirout, 'PlainText'));
                misc.Logging("Directory/folder '" + dirout + "/PlainText' created.");
            }
            catch (err) {
                misc.Logging(err + "; problem creating directory/folder '" + dirout + "/PlainText'.");
                return -1;
            }
        }
    }

    /* copy all files which start with "text" or "body" in sequence;
       output filenames are "body" with a sequential number attached */
    var cnt = 0, btarr=[];
    var text = "TEXT", body = "BODY";  
    fs.readdirSync(dirin).forEach(file => {
        const Absolute = path.join(dirin, file);
        if (text === file.substring(0,4).toUpperCase() || body === file.substring(0,4).toUpperCase())
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                btarr[cnt] = file;
                cnt++;
            }
    })
    /* sort array ascending by sequential number */
    if (btarr.length > 1)
        btarr.sort((a,b) => a.substring(4) - b.substring(4));
    /* copy file to dirout and add a new sequential number to destination filename */
    for (cnt = 0; cnt < btarr.length; cnt++) {
        const Absolute = path.join(dirin, btarr[cnt]);
        var target = path.join(dirout, "PlainText", "body") + cnt;
        fs.copyFileSync(Absolute, target);
    }
    var Tmsg = cnt + " file";
    if (cnt == 1)
        Tmsg += " ";
    else
        Tmsg += "s ";
    Tmsg += "named body or text copied to " + params[1] + "/PlainText with a sequential number appended to the filename.";
    misc.Logging(Tmsg);

    /* copy file named index, if it exists */
    var index = "INDEX", swindex;  
    fs.readdirSync(dirin).forEach(file => {
        if (index === file.toUpperCase()) {
            const Absolute = path.join(dirin, file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                var target = path.join(dirout, "PlainText", "index");
                try {
                    fs.copyFileSync(Absolute, target);
                    misc.Logging("File '" + file + "' copied to " + params[1] + "/PlainText.");
                }
                catch (err) {
                    misc.Logging(err + "; problem copying '" + file + "'.");
                    return -1;
                }
                swindex = 1;
            }
        }
    })

    /* copy file named tableofcontents, if it exists
       if it doesn't exist, create it */
    var tableofcontents = "TABLEOFCONTENTS", swtob = 0;  
    fs.readdirSync(dirin).forEach(file => {
        if (tableofcontents === file.toUpperCase()) {
            const Absolute = path.join(dirin, file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                var target = path.join(dirout, "PlainText", "tableofcontents");
                try {
                    fs.copyFileSync(Absolute, target);
                    misc.Logging("File '" + file + "' copied " + params[1] + "/PlainText.");
                }
                catch (err) {
                    misc.Logging(err + "; problem copying '" + file + "'.");
                    return -1;
                }
                swtob = 1;
            }
        }
    })

    /* copy directory named UnsureIfRelated recursively, if it exists */
    var unsure = "UNSUREIFRELATED", swunsure = 0;
    fs.readdirSync(dirin).forEach(file => {
        if (unsure === file.toUpperCase()) {
            const Absolute = path.join(dirin, file);
            if (fs.statSync(Absolute).isDirectory() && !(fs.statSync(Absolute).isSymbolicLink())) {
                var target = path.join(dirout, "UnsureIfRelated");
                try {
                    fs.copySync(Absolute, target);
                    misc.Logging("Directory/folder '" + file + "' copied recursively to " + dirout + "/PlainText.");
                }
                catch (err) {
                    misc.Logging(err + "; problem copying directory/folder '" + file + "'.");
                    return -1;
                }
                swunsure = 1;
            }
        }
    })

    if (!swtob) {
        /* create & write a tableofcontents file for PlainText directory */
        var tob = "Table of Contents of PlainText directory/folder" + os.EOL + os.EOL + "File Name           Description" + os.EOL + os.EOL +
                  "tableofcontents     Table of Contents" + os.EOL;
        tob += "body0               most recent generations of family" + os.EOL;

        for(x = 1; x < cnt; x++) {
            /* allow for up to 99999 body files */
            var blanks = "               ";
            tob += "body" + x + blanks.substring(x.length) + "next recent generations of family" + os.EOL;
        }
        if (swindex)
            tob += "index               an every-name index to the body files" + os.EOL;

        var target = path.join(dirout, "PlainText", "tableofcontents");
        try {
            fs.writeFileSync(target, tob);
            misc.Logging("Created '" + target + "'.");
        }
        catch (err) {
            misc.Logging(err + "; problem creating '" + target + "'.");
            return -1;
        }
    }

    /* create & write an index.html file for the Family DB root directory; creating our own index.html file here will prevent the
       "Parent Directory" selection which is included by the system when having no index.html file */
    var target = path.join(dirout, "index.html"), indxc = '';
    var indxc = '<!doctype html> <html lang="en"><head> <meta charset="utf-8"/> <link rel="shortcut icon" href="Include/favicon.ico"> ' +
                '<title> List of Files </title> </head><body style="margin-left:10%;margin-right:10%;line-height:1.4;font-size: ' +
                '100%" bgcolor="#ffffff"><pre> <center> <p> <h1> List of Files </h1> <p> </center><hr> <p>' + os.EOL;
    indxc += "<a href=HTML>HTML</a>" + os.EOL + "<a href=Images>Images</a>" + os.EOL + "<a href=PlainText>PlainText</a>" + os.EOL +
             "<a href=Reference>Reference</a>" + os.EOL + "<a href=UnsureIfRelated>UnsureIfRelated</a>" + os.EOL +
             "<a href=tableofcontents>tableofcontents</a>" + os.EOL + "</body> </html>";
    try {
        fs.writeFileSync(target, indxc);
        misc.Logging("Created index.html in Family DataBase root directory/folder.");
    }
    catch (err) {
        misc.Logging(err + "; problem writing '" + target + "'.");
        return -1;
    }

    /* copy directories named Other, Images and Reference recursively, if they exist */
    var other = "OTHER", images = "IMAGES", ref = "REFERENCE", GED = ".GED", swother = 0, swimages = 0, swref = 0;  
    fs.readdirSync(dirin).forEach(file => {
        if (other === file.toUpperCase() || images === file.toUpperCase() || ref === file.toUpperCase()) {
            const Absolute = path.join(dirin, file);
            if (fs.statSync(Absolute).isDirectory() && !(fs.statSync(Absolute).isSymbolicLink())) {
                if (other === file.toUpperCase()) {
                    var target = path.join(dirout, "Other");
                    swother = 1;
                } else {
                    if (images === file.toUpperCase()) {
                        var target = path.join(dirout, "Images");
                        swimages = 1;
                    } else {
                        var target = path.join(dirout, "Reference");
                        swref = 1;
                    }
                }
                try {
                    fs.copySync(Absolute, target);
                    misc.Logging("Directory/folder '" + file + "' copied recursively to " + dirout + ".");
                }
                catch (err) {
                    misc.Logging(err + "; problem copying directory/folder '" + file + "'.");
                    return -1;
                }
            }
        }
    })

    /* create the 'Other' directory if it doesn't already exist */
    misc.dirExist(path.join(dirout, 'Other'));

    /* copy any unknown files in dirin to Other in dirout */
    fs.readdirSync(dirin).forEach(file => {
        if (other !== file.toUpperCase() && images !== file.toUpperCase() && ref !== file.toUpperCase() && unsure !== file.toUpperCase() &&
                    tableofcontents !== file.toUpperCase() && index !== file.toUpperCase() && text !== file.substring(0,4).toUpperCase() &&
                    body !== file.substring(0,4).toUpperCase() && GED !== file.substring(file.lastIndexOf(".")).toUpperCase()) {
            const Absolute = path.join(dirin, file);
            var target = path.join(dirout, "Other", file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                try {
                    fs.copySync(Absolute, target);
                    misc.Logging("File '" + file + "' copied to " + dirout + "/Other.");
                }
                catch (err) {
                    misc.Logging(err + "; problem copying file '" + file + "' to " + dirout + "/Other.");
                    return -1;
                }
            }
        }
    })

    /* create & write tableofcontents for top level directory */
    var tob = "Table of Contents of top level directory" + os.EOL + os.EOL +
              "File Name           Description" + os.EOL + os.EOL + "tableofcontents     Table of Contents" + os.EOL;

    if (swimages) {
        tob += "Images              (directory/folder) contains graphical Citation files," + os.EOL + "                    ";
        tob += "photos and other graphical files regarding people in" + os.EOL + "                    the DataBase" + os.EOL;
    }
    if (swother)
        tob += "Other               (directory/folder) contains info concerning the DataBase" + os.EOL;
    tob += "PlainText           (directory/folder) contains the DataBase in plain text" + os.EOL + "                    ";
    tob += "and other files which are optional" + os.EOL;
    if (swref)
        tob += "Reference           (directory/folder) contains plain text Citation files" + os.EOL;
    if (swunsure)
        tob += "UnsureIfRelated     (directory/folder) various people who may or may not be" + os.EOL + "                    related" + os.EOL;

    var target = path.join(dirout, "tableofcontents");
    try {
        fs.writeFileSync(target, tob);
        misc.Logging("Created '" + target + "'.");
    }
    catch (err) {
        misc.Logging(err + "; problem writing '" + target + "'.");
        return -1;
    }

    /* if importing a Gedcom, the DBinfo.txt file was created elsewhere */
    if (params[6] == "U") {
        /* create (or, if user provided, add to) DBinfo.txt in the Other directory */
        var target = path.join(dirout, "Other", "DBinfo.txt"), DBinfo, targetin = path.join(dirin, "Other", "DBinfo.txt");
        if (!fs.existsSync(targetin)) {
            DBinfo = misc.createDBinfo (-1, params[1])
            try {
                fs.writeFileSync(target, DBinfo);
                misc.Logging("Created complete '" + target + "'.");
            }
            catch (err) {
                misc.Logging(err + "; problem writing '" + target + "'.");
                return -1;
            }
        } else {
            DBinfo = fs.readFileSync(targetin, "utf8");
            /* remove previously added generated fields if they exist */
            var prevGen = DBinfo.indexOf("#" + os.EOL + "# generated fields; ");
            if (prevGen != -1)
                DBinfo = DBinfo.substring(0, prevGen);
            DBinfo += misc.createDBinfo (-2, params[1])
            try {
                fs.writeFileSync(target, DBinfo);
                misc.Logging("Added generated info to '" + target + "'.");
            }
            catch (err) {
                misc.Logging(err + "; problem writing '" + target + "'.");
                return -1;
            }
        }
    }

    /* create & write a tableofcontents file for Other directory if it doesn't already exist */
    if (!fs.existsSync(path.join(dirin, "Other", "tableofcontents"))) {
        var ws = "                               ",
            tob = "Table of Contents of Other directory/folder" + os.EOL + os.EOL + "File Name                      Description" + os.EOL +
                  os.EOL + "tableofcontents                Table of Contents" + os.EOL;
        /* get a list of all files & directories in Other directory */
        if (fs.existsSync(path.join(dirout, "Other"))) {
            const stats = fs.statSync(path.join(dirout, "Other"));
            if (stats.isDirectory()) {
                fs.readdirSync(path.join(dirout, "Other")).forEach(file => {
                    switch (file) {
                        case "AdditionalInfoNotIncluded.txt":
                            tob += "AdditionalInfoNotIncluded.txt  list of people for whom there is additional" + os.EOL +
                                   "                               info that is not included in this DataBase" + os.EOL;
                            break;
                        case "Bibliography.txt":
                            tob += "Bibliography.txt               list of reference material used in this DataBase" + os.EOL;
                            break;
                        case "DBinfo.txt":
                            tob += "DBinfo.txt                     info describing this DataBase (used by" + os.EOL +
                                   "                               MELGenUtils)" + os.EOL;
                            break;
                        case "Dedication.txt":
                            tob += "Dedication.txt                 dedication" + os.EOL;
                            break;
                        case "DevHistory.txt":
                            tob += "DevHistory.txt                 development history regarding this DataBase" + os.EOL;
                            break;
                        case "FamilyObscurities.txt":
                            tob += "FamilyObscurities.txt          obscure info pertaining to some people and/or" + os.EOL +
                                   "                               families appearing in this DataBase" + os.EOL;
                            break;
                        case "Founders.txt":
                            tob += "Founders.txt                   list of people in this DataBase who founded" + os.EOL +
                                   "                               something" + os.EOL;
                            break;
                        case "Introduction.txt":
                            tob += "Introduction.txt               introduction to this DataBase" + os.EOL;
                            break;
                        case "NotablePeople.txt":
                            tob += "NotablePeople.txt              info with regard to some notable people" + os.EOL +
                                   "                               appearing in this DataBase" + os.EOL;
                            break;
                        case "Notes.txt":
                            tob += "Notes.txt                      miscellaneous notes pertaining to this DataBase" + os.EOL;
                            break;
                        case "Preface.txt":
                            tob += "Preface.txt                    preface to this DataBase" + os.EOL;
                            break;
                        case "README.txt":
                            tob += "README.txt                     basic info pertaining to this DataBase" + os.EOL;
                            break;
                        case "ReleaseNotes.txt":
                            tob += "ReleaseNotes.txt               notes pertinent to the current release of" + os.EOL +
                                   "                               this DataBase" + os.EOL;
                            break;
                        case "ResearchToDo.txt":
                            tob += "ResearchToDo.txt               notes pertaining to additional research which" + os.EOL +
                                   "                               could/should be done regarding this DataBase" + os.EOL;
                            break;
                        case "Statistics.txt":
                            tob += "Statistics.txt                 some statistics regarding this DataBase" + os.EOL;
                            break;
                        case "SurnameRecap.txt":
                            tob += "SurnameRecap.txt               general notes with regard to some surnames" + os.EOL +
                                   "                               appearing in the DataBase" + os.EOL;
                            break;
                        case "UsersGuide.txt":
                            tob += "UsersGuide.txt                 a guide for using this DataBase" + os.EOL;
                            break;
                        default:
                            if (file.length > 30)
                                tob += file[0, 29] + " contents unknown" + os.EOL;
                            else
                                tob += file + ws.substring(0, (31 - file.length)) + "contents unknown" + os.EOL;
                            break;
                    }
                })
            }
        }

        var target = path.join(dirout, "Other", "tableofcontents");
        try {
            fs.writeFileSync(target, tob);
            misc.Logging("Created '" + target + "'.");
        }
        catch (err) {
            misc.Logging(err + "; problem creating '" + target + "'.");
            return -1;
        }
    }

    if (params[6] == "G") {
        /* if importing from Gedcom, the body files and the Other/DBinfo.txt file was created in the input directory;
           delete them, and if the Other directory contains no other files remove the directory */
        var delsw = 0;

        fs.readdirSync(dirin).forEach(file => {
            const Absolute = path.join(dirin, file);
            if (!fs.statSync(Absolute).isDirectory() && file.substring(0, 4) == "body" &&
                                   file.substring(file.length - 4, file.length) != ".ged") {
                try {
                    fs.rmSync(Absolute, { recursive: false, force: true });
                    delsw = 1;
                }
                catch (err) {
                    misc.Logging(err + "; problem trying to delete '" + Absolute + "'.");
                    return -1;
                }
            }
        })
        const Absolute = path.join(dirin, "Other", "DBinfo.txt");
        try {
            fs.rmSync(Absolute, { recursive: false, force: true });
            delsw = 1;
        }
        catch (err) {
            misc.Logging(err + "; problem trying to delete '" + Absolute + "'.");
            return -1;
        }
        if (fs.readdirSync(path.join(dirin, "Other")).length === 0) {
            try {
                fs.rmdirSync(path.join(dirin, "Other"), { recursive: false, force: true });
                delsw = 1;
            }
            catch (err) {
                misc.Logging(err + "; problem trying to delete empty directory/folder '" + path.join(dirin, "Other") + "'.");
                return -1;
            }
        }

        if (delsw)
            misc.Logging("Deleted temporary files in import directory/folder '" + dirin + "' created during import time.");
    }

    /* if the DB name that's being imported already exists in DBSysInfo then delete it; it will be re-added with the new criteria */
    var namepos = DBSysInfo.indexOf("DBName = \"" + params[1], 0);
    if (namepos != -1) {
        var i, j, holdDB = DBSysInfo;
        for (i = namepos; i > 0; i--) {
            if (holdDB.substring(i, i + 10) == "DBActive =") {
                j = holdDB.indexOf("\n\n", i);    /* find end of this DB entry */
                DBSysInfo = holdDB.substring(0, i - 1) + holdDB.substring(j + 1);
                break;
            }
        }
        if (!i) {
            /* this should never happen */
            misc.Logging("***** Internal Error - Did not find DBActive string in MELGenUtilsInfo.txt when trying to make imported DB active. *****");
            process.exit();
        }
    }

    /* update DBSysInfo */
    if (action) {
        /* de-activate current DB */
        var activepos = DBSysInfo.indexOf("DBActive = \"yes\"", 0);
        if (activepos != -1) {
            activepos += 12;
            DBSysInfo = DBSysInfo.substring(0, activepos) + 'no"' + DBSysInfo.substring(activepos + 4);
        }
    }
    /* add imported DataBase */
    DBSysInfo += 'DBActive = "'
    if (action) {
        DBSysInfo += 'yes';
        misc.Logging("Imported DataBase activated.");
    } else
        DBSysInfo += 'no';
    DBSysInfo += '"' + os.EOL + 'DBName = "' + params[1] + '"' + os.EOL + 'DBUserID = "' + fid + '"' + os.EOL + 'DBStatus = "0"' + os.EOL +
                 'DBSecurity = "' + prot + '"' + os.EOL;
    DBSysInfo += 'DBLocation = "DBs/' + params[1] + '"' + os.EOL + os.EOL;
    if (params[5] == "yes") {
        /* remove import directory and it's contents */
        try {
            fs.rmSync(dirin, { recursive: true, force: true });
            misc.Logging("Deleted import directory/folder '" + dirin + "' and all it's contents.");
        }
        catch (err) {
            misc.Logging(err + "; problem deleting import directory/folder '" + dirin + "'.");
            return -1;
        }
    }
    /* write MELGenUtilsInfo.txt */
    try {
        fs.writeFileSync('MELGenUtilsInfo.txt', DBSysInfo);
        misc.Logging("MELGenUtilsInfo.txt updated with new DataBase info.");
        misc.Logging("MELGenUtilsInfo.txt written.");
    }
    catch (err) {
        misc.Logging(err + "; problem writing 'MELGenUtilsInfo.txt'.");
        return -1;
    }

    misc.Logging("DataBase '" + params[1] + "' successfully imported.");
    return 0;  /* successful import */
}

module.exports = { ImportDB, PerformImportDB };

