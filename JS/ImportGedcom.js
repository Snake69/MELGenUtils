const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const misc = require("./misc.js");

var citations = [[]], citationsFamGrp = [[]], notes = [], cnotes = [], timeline = [], ctimeline = [], alreadyDone = [[]], only1citation,
    numcites, noSour, ged, SPECSW = 0;

async function GedChecks (postdata) {
    var swtob = 0, abs2read, fpath, x, y, Gerror = '', Gmsg = '';

    /* do some checks before importing a GEDCOM */

    /* remove any leading and following whitespace */
    postdata.dbin_loc = postdata.dbin_loc.trim();
    postdata.db_name = postdata.db_name.trim();

    /* ensure path to location of data to import is absolute */
    if (path.isAbsolute(postdata.dbin_loc))
        fpath = path.normalize(postdata.dbin_loc);                       // absolute path
    else
        if (postdata.dbin_loc[0] == ".") {
            var sysloc = misc.ProcessDBSysInfo("SysLocation");
            fpath = path.join (sysloc, postdata.dbin_loc);               // relative path
        } else {
            var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
            fpath = path.join (homedir, postdata.dbin_loc);              // path base is home directory
        }
    postdata.dbin_loc = fpath;

    /* various validation checks for db-in location & contents */
    if (!fs.existsSync(postdata.dbin_loc))
        Gerror += "The '" + postdata.dbin_loc + "' directory/folder does not exist.<br> <br>";
    else {
        const stats = fs.statSync(postdata.dbin_loc);
        if (!stats.isDirectory())
            Gerror += "'" + postdata.dbin_loc + "' exists but is not a directory/folder.<br> <br>";
        else {
            if (postdata.dbin_loc == misc.ProcessDBSysInfo ("SysLocation")) {
                Gerror += "'" + postdata.dbin_loc + "' is the location of the MELGenUtils System. ";
                Gerror += "The location of the data to import needs to be different.<br> <br>";
            } else {
                var cnt = 0, ged = ".GED";
                var dir = postdata.dbin_loc;

                fs.readdirSync(dir).forEach(file => {
                    const Absolute = path.join(dir, file);
                    if (!fs.statSync(Absolute).isDirectory() && !fs.statSync(Absolute).isSymbolicLink())
                        if (ged === file.slice(-4).toUpperCase()) {
                            abs2read = Absolute;
                            cnt++;

                            var stats = fs.statSync(Absolute);
                            if (stats.size >= 200000000) {
                                misc.Logging("The Gedcom file '" + Absolute + "' is too large \(200MB or bigger\) to read.");
                                Gerror += "The Gedcom file '" + Absolute + "' is too large \(200MB or bigger\) to read. " +
                                          "Make it smaller and try again.<br> <br>";
                            }
                        }
                })
                if (cnt == 1) {
                    Gmsg += "One GEDCOM file exists in the directory/folder '" + dir + "'.<br> <br>";
                    x = 0;
                    ged = fs.readFileSync(abs2read, { encoding: 'utf8' });
                    ged = ged.replace(/\r\n/g, '\n');
                    /* check gedcom for INDI records */
                    while (x != -1) {
                        x = ged.indexOf('INDI', x);
                        if (x != -1) {
                            y = ged.lastIndexOf("\n" + '0 @', x);
                            if (y != -1)
                                break;
                            else
                                x++;
                        }
                    }
                    if (x == -1)
                        Gerror += "The Gedcom file does not contain any INDI records " +
                                  "(i.e., individual records which contain various relevant data).<br> <br>";
                    /* check gedcom for SOUR records */
                    x = 0;
                    y = -1;
                    while (x != -1) {
                        x = ged.indexOf('SOUR', x);
                        if (x != -1) {
                            y = ged.lastIndexOf('0 ', x);
                            if (ged.substring(y + 2, y + 6) == "HEAD") {
                                y = 0;
                                x++;
                            }
                            else {
                                y = 1;
                                x = -1;
                            }
                        }
                    }
                    if (y <= 0)
                        Gerror += "There are no SOUR records (sources) in the Gedcom";
                    if (!y)
                        Gerror += " (other than in the HEAD section which indicates where the Gedcom itself came from)";
                    if (y <= 0)
                        Gerror += ".<br><br>A source for any data to be used is required by MELGenUtils.<br><br>";
                    /* make sure at least one family in gedcom has children */
                    x = ged.indexOf('FAMC');
                    if (x == -1)
                        Gerror += "No families in the Gedcom have children.<br><br>" +
                                  "Only families with children can be a Family Group (i.e., there is nothing to import).<br><br>";
                } else
                    if (!cnt)
                        Gerror += "A GEDCOM file (required) does not exist in the directory/folder '" + dir + "'.<br> <br>";
                    else
                        Gerror += "There can be only one GEDCOM file in the directory/folder '" + dir + "'.<br> <br>";

                var tob = "TABLEOFCONTENTS";
                fs.readdirSync(dir).forEach(file => {
                    if (tob === file.toUpperCase())
                        swtob = 1;
                })

                if (!swtob) {
                    Gmsg += "tableofcontents does not exist in the directory/folder '" + postdata.dbin_loc + "'; ";
                    Gmsg += "it will be auto-created.<br> <br>";
                }
            }
            if (postdata.hasOwnProperty('RemoveDir'))
                Gmsg += "The import directory/folder ('" + dir + "') and all it's contents will be removed only after a successful import." +
                        "<br> <br>";
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
        Gerror += "20 DataBases have been imported. 20 is the maximum. To remove an imported DataBase and make room";
        Gerror += "for the new DataBase use 'Import, Create or Remove a Family DataBase -> Deport a Family DataBase'.<br> <br>";
    } else {
        if (!fs.existsSync(path.join ("DBs", postdata.db_name)))
            Gmsg += "The '" + postdata.db_name + "' directory/folder does not exist; it will be auto-created.<br> <br>";
        else {
            const stats = fs.statSync(path.join ("DBs", postdata.db_name));
            if (!stats.isDirectory()) {
                Gerror += "'" + postdata.db_name + "' exists but is not a directory/folder.<br> <br>";
            } else {
                try {
                    fs.accessSync(path.join ("DBs", postdata.db_name), fs.constants.W_OK)
                }
                catch(e) {
                    Gerror += "Directory permissions won't allow writing to '" + postdata.db_name + "'.<br> <br>";
                }

                var numfiles = misc.GoThruDirectory(path.join ("DBs", postdata.db_name), 1);
                if (numfiles) {
                    Gmsg += "A Family DataBase named '" + postdata.db_name + "' already exists. The DataBase will be backed up ";
                    Gmsg += "before importing the new DataBase.<br> <br>";
                }
            }
        }
    }
    return [Gerror, Gmsg];
}

function createFiles (pd) {
    var DBinfo, dirin, target, ged, CFmsg = '';

    pd.dbin_loc = pd.dbin_loc.trim();
    if (path.isAbsolute(pd.dbin_loc))
        dirin = path.normalize(pd.dbin_loc);                     // absolute path
    else
        if (pd.dbin_loc[0] == ".") {
            var sysloc = misc.ProcessDBSysInfo("SysLocation");
            dirin = path.join (sysloc, pd.dbin_loc);             // relative path
        } else {
            var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
            dirin = path.join (homedir, pd.dbin_loc);            // path base is home directory
        }

    // read Gedcom
    ged = ".GED";
    fs.readdirSync(dirin).forEach(file => {
        const Absolute = path.join(dirin, file);
        if (!fs.statSync(Absolute).isDirectory() && !fs.statSync(Absolute).isSymbolicLink())
            if (ged === file.slice(-4).toUpperCase()) {
                ged = fs.readFileSync(Absolute, { encoding: 'utf8' });
                ged = ged.replace(/\r\n/g, '\n');
                ged = misc.convertToAscii(ged);
            }
    })

    // create DBinfo.txt file in input directory; it will be deleted later
    DBinfo = misc.createDBinfo(ged, pd.db_name.trim());
    if (!fs.existsSync(path.join(dirin, 'Other'))) {
        try {
            fs.mkdirSync(path.join(dirin, 'Other'));
            misc.Logging("'Other' directory/folder created.");
        }
        catch (err) {
            misc.Logging(err + "; problem creating directory/folder '" + dirin + "/Other'.");
            CFmsg += "Problem creating directory/folder '" + dirin + "/Other'.\n\n";
        }
    }
    target = path.join(dirin, "Other", "DBinfo.txt");
    try {
        fs.writeFileSync(target, DBinfo);
        misc.Logging("'DBinfo.txt' file created or appended.");
    }
    catch (err) {
        misc.Logging(err + "; problem writing '" + target + "'.");
        CFmsg += "Problem writing '" + target + "'.\n\n";
    }
    return CFmsg;
}

module.exports = { GedChecks, createFiles };

