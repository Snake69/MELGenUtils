const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const misc = require("./misc.js");

var citations = [[]], citationsFamGrp = [[]], indiIDs = [[]], notes = [], timeline = [], only1citation, numcites, noSour, DBdata, ged;
var SPECSW = 0;

async function GedChecks (postdata) {
    var swtob = 0, fpath, abs2read, x, y, Gerror = '', Gmsg = '';

    /* do some checks before importing a DB created from a GEDCOM */

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
                Gerror += "'" + postdata.dbin_loc + "' is the location of the MELGenKey System. ";
                Gerror += "The location of the data to import needs to be different.<br> <br>";
            } else {
                var cnt = 0, text = "TEXT", body = "BODY", ged = ".GED";
                var dir = postdata.dbin_loc;

                fs.readdirSync(dir).forEach(file => {
                    const Absolute = path.join(dir, file);
                    if (!fs.statSync(Absolute).isDirectory() && !fs.statSync(Absolute).isSymbolicLink())
                        if (ged === file.slice(-4).toUpperCase()) {
                            abs2read = Absolute;
                            cnt++;
                        }
                })
                if (cnt == 1) {
                    Gmsg += "One GEDCOM file exists in the directory/folder '" + dir + "'.<br> <br>";
                    x = 0;
                    ged = fs.readFileSync(abs2read, { encoding: 'utf8' });
                    ged = ged.replace(/\r\n/g, '\n');
                    /* make sure gedcom contains an INDI record */
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
                                  "(i.e., individual records which contain the data to import).<br> <br>";
                    /* make sure gedcom contains a usable SOUR record */
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
                        Gerror += ".<br><br>A source for any data to be imported is required by MELGenKey.<br><br>";
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
                    Gmsg += "A Family DataBase named '" + postdata.db_name + "' already exists. The DataBase will be backup up ";
                    Gmsg += "before importing the new DataBase.<br> <br>";
                }
            }
        }
    }
    return [Gerror, Gmsg];
}

function ParseGedcom (postdata, directive, who) {
    var b, e, tosend = "", indirec, sect, retitems;
    var gedfn = ".GED";
    var dirin;

    if (path.isAbsolute(postdata.dbin_loc))
        dirin = path.normalize(postdata.dbin_loc);                       // absolute path
    else
        if (postdata.dbin_loc[0] == ".") {
            var sysloc = misc.ProcessDBSysInfo("SysLocation");
            dirin = path.join (sysloc, postdata.dbin_loc);               // relative path
        } else {
            var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
            dirin = path.join (homedir, postdata.dbin_loc);              // path base is home directory
        }

    /* read GEDCOM */
    fs.readdirSync(dirin).forEach(file => {
        if (gedfn === file.slice(-4).toUpperCase()) {
            const Absolute = path.join(dirin, file);
            if (!(fs.statSync(Absolute).isDirectory()) && !(fs.statSync(Absolute).isSymbolicLink())) {
                var stats = fs.statSync(Absolute);
                if (stats.size < 200000000) {
                    try {
                        ged = fs.readFileSync(Absolute, { encoding: 'utf8' });
                        misc.Logging("Read '" + Absolute + "'.");
                        /* ensure Gedcom is ASCII */
                        ged = convertToAscii(ged);
                        misc.Logging("Ensured contents of Gedcom is ASCII. MELGenKey cannot handle non-ASCII characters at this time. " +
                                     "\(Changed internally only. Did not alter actual Gedcom file.\)");
                        ged = ged.replace(/\r\n/g, "\n");
                        misc.Logging("Removed \"\\r\"'s from Gedcom. \(Changed internally only. Did not alter actual Gedcom file.\)");
                    }
                    catch (err) {
                        misc.Logging(err + "; problem reading '" + Absolute + "'.");
                    }
                } else {
                    misc.Logging("The Gedcom file '" + Absolute + "' is too large \(200MB or bigger\) to read.");
                    return "The Gedcom file '" + Absolute + "' is too large \(200MB or bigger\) to read. " +
                           "Make it smaller and try again.<br> <br>";
                }
            }
        }
    })
    /* provide some feedback for user */
    if (directive == "indid") {
        /* extract INDI section */
        retitems = misc.extract0Rec (ged, '@' + who + '@ ', "INDI", 0);
        indirec = retitems.str;

        tosend += '<!doctype html> <html> <head> <style> .first { float: left; width: 8%; } ' + '.second { float: left; width: 15%; } ' +
                  '.third { float: left; width: 6%; } .fourth { float: left; width: 25%; } ' + '.fifth { float: left; width: 6%; } ' +
                  '.sixth { float: left; width: 25%; } </style> </head> <body> <pre>';
        tosend += os.EOL + "<center>Individual from GEDCOM Who Will be Starting the Family DataBase</center>" + os.EOL + os.EOL;

        if (indirec == "")
            tosend += os.EOL + os.EOL + "Individual ID '" + who + "' does not exist in the GEDCOM." + os.EOL + os.EOL;
        else {
            /* check if selected ID has children; having children is required to be the root of a MELGenKey Family DB */
            var chld = misc.Check4Children (ged, indirec);
            if (chld != 0) {
                tosend += '<div class="container"> <div class="first">ID</div> <div class="second">Name</div> ' +
                          '<div class="third">Birthdate</div> <div class="fourth">Birthplace</div> <div class="fifth">Deathdate</div> ' +
                          '<div class="sixth">Deathplace</div></div>' + os.EOL + os.EOL;
                /* ID */
                tosend += '<div "class="container"> <div id="divid" class="first">' + who + '</div><div class="second">';
                /* Given Name */
                retitems = misc.extractField (indirec, "2", "GIVN", 0);
                tosend += retitems.str;
                /* Surname */
                retitems = misc.extractField (indirec, "2", "SURN", 0);
                tosend += retitems.str;
                /* extract BIRT section */
                sect = misc.extractSect (indirec, "1", "BIRT");
                /* Birth Date */
                tosend += '</div><div class="third">';
                retitems = misc.extractField (sect, "2", "DATE", 0);
                tosend += retitems.str;
                /* Birth Place */
                tosend += '</div><div class="fourth">';
                retitems = misc.extractField (sect, "2", "PLAC", 0);
                tosend += retitems.str;
                /* extract DEAT section */
                sect = misc.extractSect (indirec, "1", "DEAT");
                /* Death Date */
                tosend += '</div><div class="fifth">';
                retitems = misc.extractField (sect, "2", "DATE", 0);
                tosend += retitems.str;
                /* Death Place */
                tosend += '</div><div class="sixth">';
                retitems = misc.extractField (sect, "2", "PLAC", 0);
                tosend += retitems.str;
                tosend += '</div></div>' + os.EOL;
            } else {
                tosend += os.EOL + os.EOL + "Individual ID '" + who +
                          "' is not eligible to be the root of a Family DataBase because he/she has no children." + os.EOL;
                tosend += "In this particular case the father or mother of ID '" + who +
                          "' would be eligible to be the root of a Family DataBase." + os.EOL;
                tosend += "Select one of the parents instead, or list all the eligible individuals and select from the list." + os.EOL + os.EOL;
            }
        }
        tosend += "</pre> <center>  <button id='abort' onclick='window.close();'>Cancel/Abort</button> " +
                  "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp <button id='acceptid' type='button' " +
                  "onclick='window.opener.setValue(true);window.close();'>Accept & Close</button> </center> </body> </html>";
        return tosend;
    }

    if (directive == "listall") {
        tosend += '<!doctype html> <html> <head> <style> .radiobut { float: left; width: 5%; } .first { float: left; width: 8%; } ' +
                  '.second { float: left; width: 15%; } .third { float: left; width: 6%; } .fourth { float: left; width: 25%; } ' +
                  '.fifth { float: left; width: 6%; } .sixth { float: left; width: 25%; } </style> </head> <body> <pre>';
        tosend += os.EOL + "<center>All Individuals in GEDCOM</center>" + os.EOL + os.EOL;
        tosend += os.EOL + "<center>Select Starting/Base/Root Individual (ID# 1.0) for the Family DataBase</center>" + os.EOL + os.EOL;
        tosend += '<div class="container"><div class="radiobut">Select</div> <div class="first">ID</div> <div class="second">Name</div> ' +
                  '<div class="third">Birthdate</div> <div class="fourth">Birthplace</div> <div class="fifth">Deathdate</div> ' +
                  '<div class="sixth">Deathplace</div></div>' + os.EOL + os.EOL;
        for (var j = i = 0; i < ged.length; i++, j++) {
            /* extract INDI section */
            b = ged.indexOf('@ INDI', i);
            if (b == -1)
                break;
            b = ged.lastIndexOf('0 @', b);
            e = ged.indexOf('0 ', b + 1);
            if (b == -1 || e == -1)
                break;
            else
                indirec = ged.toString().substring(b, e);
            i = e - 1;

            /* check if INDI rec has children; having children is required to be the root of a MELGenKey Family DB */
            var chld = misc.Check4Children (ged, indirec);
            if (chld != 0) {
                lit1 = "but" + j;
                lit2 = "div" + j;
                tosend += '<div "class="container"><div class="radiobut"> <input type="radio" id="' + lit1 + '" name="person" value="' + lit1 +
                          '"></div> ' + '<div id="' + lit2 + '"class="first">' +
                          indirec.substring(3, indirec.indexOf('@', 3)) + '</div><div class="second">';
                /* Given Name */
                retitems = misc.extractField (indirec, "2", "GIVN", 0);
                tosend += retitems.str;
                /* Surname */
                retitems = misc.extractField (indirec, "2", "SURN", 0);
                tosend += retitems.str;

                /* extract BIRT section */
                sect = misc.extractSect (indirec, "1", "BIRT");
                /* Birth Date */
                tosend += '</div><div class="third">';
                retitems = misc.extractField (sect, "2", "DATE", 0);
                tosend += retitems.str;
                /* Birth Place */
                tosend += '</div><div class="fourth">';
                retitems = misc.extractField (sect, "2", "PLAC", 0);
                tosend += retitems.str;

                /* extract DEAT section */
                sect = misc.extractSect (indirec, "1", "DEAT");
                /* Death Date */
                tosend += '</div><div class="fifth">';
                retitems = misc.extractField (sect, "2", "DATE", 0);
                tosend += retitems.str;
                /* Death Place */
                tosend += '</div><div class="sixth">';
                retitems = misc.extractField (sect, "2", "PLAC", 0);
                tosend += retitems.str;
                tosend += '</div></div>' + os.EOL;
            }
        }
        tosend += '<div class="container"><div class="radiobut"> <input type="radio" id="none" name="person" value="none">NONE</div>' + os.EOL;
        tosend += "</pre> <center> <button id='acceptInd' onclick='window.close();'>Accept & Close</button> </center> </body> </html>";
        return tosend;
    }
}

function createFiles (pd, id) {
    var x, y, z, b, e, idp, id2, retitems, family, generation, DBinfo, indirec, nextid, indx, gen, sourrec, tocpt, toctl, dirin, target;

    if (id == "none")
        /* user did not select a starting ID */
        return;

    noSour = 0;
    DBdata = os.EOL;
    DBinfo = misc.createDBinfo(ged, pd.db_name.trim());

    /* save SOUR recs */
    citations.length = 0;
    for (x = y = 0; y < ged.length; y++) {
        b = ged.indexOf(' SOUR', y);
        if (b == -1)
            break;
        /* if the 0 record is a HEAD record, skip it */
        z = ged.lastIndexOf('0 ', b);
        if (ged.substring(z + 2, z + 6) == "HEAD")
            continue;
        if (ged[b - 1] == "@") {
            /* hit a 0 SOUR record */
            b--;
            b = ged.lastIndexOf("\n" + '0 @', b) + 1;
            e = ged.indexOf("\n" + '0 ', b) + 1;
            if (b == -1 || e == -1)
                break;
            else {
                sourrec = ged.substring(b, e);
                citations.push([sourrec.substring(3, sourrec.indexOf('@', 3)),""]);
                retitems = misc.extractField (sourrec, "1", "TITL", 0);
                if (typeof retitems.str != "undefined" && retitems.str != "undefined")
                    var stitle = retitems.str.trim();
                else
                    var stitle = "";
                retitems = misc.extractField (sourrec, "1", "AUTH", 0);
                if (typeof retitems.str != "undefined" && retitems.str != "undefined")
                    var sauthor = retitems.str.trim();
                else
                    var sauthor = "";
                retitems = misc.extractField (sourrec, "2", "DATE", 0);
                if (typeof retitems.str != "undefined" && retitems.str != "undefined")
                    var sdate = retitems.str.trim();
                else
                    var sdate = "";
                if (sauthor != "")
                    citations[x][1] += sauthor;
                if (stitle != "")
                    if (citations[x][1] != "")
                        citations[x][1] += ", " + stitle;
                    else
                        citations[x][1] += stitle;
                if (sdate != "")
                    citations[x][1] += ", " + sdate;
                x++;
            }
            y = e - 1;
        } else {
            if (ged[b + 6] == "@")
                /* if it's a reference/link, skip it */
                continue;
            for (z = 0; z < citations.length; z++)
                if (citations[z][1] == ged.substring(b + 6, ged.indexOf("\n", b + 6)))
                    break;
            if (z == citations.length) {
                citations.push([-1,ged.substring(b + 6, ged.indexOf("\n", b + 6))]);
                x++;
            }
            y = b + 1;
        }
    }
    numcites = x;
    if (x == 1)
        only1citation = 1;
    else
        only1citation = 0;

    /*
       make two passes through GEDCOM
       pass 1 - build array, the contents of which will identify for which individuals to build Family Groups
       pass 2 - build Family Groups
    */

    indiIDs.length = 0;
    generation = 1;
    indx = 0;
    gen = 1;

    while (1) {
        for (x = 0; x < generation / 2; x++)
            if (generation == 1) {
                indiIDs.push([id,gen,,]);
                addParents();
                gen++;
            } else {
                indiIDs.push([indiIDs[indx][2],gen,,]);
                addParents();
                indiIDs.push([indiIDs[indx][3],gen + 1,,]);
                addParents();
                indx++;
                gen += 2;
            }
        for (x = indiIDs.length - generation; x < indiIDs.length; x++)
            if (indiIDs[x][0] != -1)
                break;
        if (x == indiIDs.length)
            /* no more generations to process; end of array */
            break;
        generation *= 2;
    }

    /* extract info from GEDCOM */
    for (x = y = 0; x < indiIDs.length; x++) {
        if (indiIDs[x][0] == -1)
            continue;
        retitems = misc.extract0Rec (ged, '@' + indiIDs[x][0] + '@ ', "INDI", 0);
        indirec = retitems.str;
        /* if INDI has children then do Family Group */
        var chld = misc.Check4Children (ged, indirec);
        if (chld != 0) {
            /* extract FAMS record for indirec */
            family = misc.findFam (ged, indirec, "FAMS");
            if (!family)
                misc.Logging("***** FAMS record for " + indirec + " does not exist in Gedcom! This should never happen. *****");
            if (family != 0 && family != -1) {
                idp = misc.getParentID (ged, indirec, "HUSB");
                if (idp)
                    y++
                if (!x)
                    id2 = -1;
                else
                    id2 = indiIDs[x + 1][0];
                if (typeof retitems.str != "undefined" && retitems.str != "undefined") {
                    z = buildFamGroup (ged, family, indiIDs[x][0], indiIDs[x][1], id2, 0);
                    if (x)
                        x++;                // without this the spouse would get done a second time
                    if (z && z != -1)
                        DBdata += z;
                }
            }
        }
    }

    /* some final clean-up */
    /* if the Family Group pointed to by a "Father - " or "Mother - " line did not get created (usually because of a lack of sources) then
       substitute the reference ID and name with "name unknown" */
    for (x = 0; x < DBdata.length; ) {
        y = DBdata.indexOf("Father - ", x);
        if (y == -1)
            /* reached end of data */
            break;
        if (DBdata[y + 9] >= '0' && DBdata[y + 9] <= '9') {
            z = DBdata.substring(y + 9, DBdata.indexOf("  ", y + 9));
            x = DBdata.indexOf("\n" + z + "  ", y);
            if (x == -1) {
                DBdata = DBdata.substring(0, y + 9) + "name unknown" + DBdata.substring(DBdata.indexOf("\n", y + 9));
                noSour++;
            }
        }
        y = DBdata.indexOf("Mother - ", y);
        if (y == -1)
            /* THIS SHOULD NEVER HAPPEN */
            break;
        if (DBdata[y + 9] >= '0' && DBdata[y + 9] <= '9') {
            z = DBdata.substring(y + 9, DBdata.indexOf("  ", y + 9));
            x = DBdata.indexOf("\n" + z + "  ", y);
            if (x == -1) {
                DBdata = DBdata.substring(0, y + 9) + "name unknown" + DBdata.substring(DBdata.indexOf("\n", y + 9));
                noSour++;
            }
        }
        x = y; 
    }

    if (noSour) {
        var Lmsg;
        Lmsg = noSour + " ";
        if (noSour == 1)
            Lmsg += "item/event";
        else
            Lmsg += "items/events";
        Lmsg += " NOT added to the MELGenKey Family DataBase because there was no associated source.";

        misc.Logging(Lmsg);
    }

    if (DBdata.length == 1)
        /* no data to import */
        specialSW = -69;
    else {
        if (path.isAbsolute(pd.dbin_loc))
            dirin = path.normalize(pd.dbin_loc);                       // absolute path
        else
            if (pd.dbin_loc[0] == ".") {
                var sysloc = misc.ProcessDBSysInfo("SysLocation");
                dirin = path.join (sysloc, pd.dbin_loc);               // relative path
            } else {
                var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
                dirin = path.join (homedir, pd.dbin_loc);              // path base is home directory
            }

        if (!fs.existsSync(path.join(dirin, 'Other'))) {
            try {
                fs.mkdirSync(path.join(dirin, 'Other'));
                misc.Logging("'Other' directory/folder created.");
            }
            catch (err) {
                misc.Logging(err + "; problem creating directory/folder '" + dirin + "/Other'.");
            }
        }
        target = path.join(dirin, "Other", "DBinfo.txt");
        try {
            fs.writeFileSync(target, DBinfo);
            misc.Logging("'DBinfo.txt' file created or appended.");
        }
        catch (err) {
            misc.Logging(err + "; problem writing '" + target + "'.");
        }
        target = path.join(dirin, "body");

        try {
            fs.writeFileSync(target, DBdata);
        }
        catch (err) {
            misc.Logging(err + "; problem writing '" + target + "'.");
        }
    }
}

function buildFamGroup (gedcom, family, id, gen, id2, suffix) {
    var x, y, i = 0, j, b, e, rdata = "", numch = 0, irec, irecsp, father, mother, children = "", edate, eplace, sequence,
        retitems, idt, iName, i2Name, chName, fName, mName, sect, chFamsw;

/*
  follow line for spouses in HOF (there can be more than 1)
  if parents
    for every child of parents (except direct line child)
      check whether or not to do a Family Group for that child
      for every child with its own Family Group, add 1 to sequence
*/

    timeline.length = notes.length = sequence = 0;

    /* extract INDI for ID */
    retitems = misc.extract0Rec (gedcom, "@" + id + "@", "INDI", 0);
    irec = retitems.str;
    if (irec == "") {
        misc.Logging("***** INDI record for " + id + " does not exist in Gedcom! This should never happen. *****");
        return -1;
    }
    /* check if this individual has children */
    x = misc.Check4Children (gedcom, irec);
    if (!x)
        /* if this individual has no children don't create a Family Group */
        return 0;

    /* build array for sources used by this family */
    if (buildFamGrpCites (irec) == -1)
        /* no sources for this Family Group */
        return -1;

    /* family group header */
    rdata += gen + "." + suffix + "  ";
    retitems = misc.extractField (irec, "2", "GIVN", 0);
    if (retitems.str.trim() == '') {
        iName = "------";
        rdata += "------";                               // HOF given name
    } else {
        iName = retitems.str.trim();
        rdata += retitems.str.trim();                    // HOF given name
    }
    retitems = misc.extractField (irec, "2", "SURN", 0);
    iName += " " + retitems.str.trim();                  // iName contains full name of INDI
    rdata += " " + retitems.str.trim() + os.EOL;         // HOF surname

    /* Father & Mother lines */
    rdata += "Father - ";
    var idph = misc.getParentID (gedcom, irec, "HUSB");
    if (idph == '')
        rdata += "name unknown";
    else {
        /* get Father's name & MELGenKey ID */
        fName = misc.getParentName (gedcom, irec, "HUSB");
        if (fName == "")
            rdata += "name unknown";
        else {
            idp = misc.getParentID (gedcom, irec, "HUSB");
            if (idp) {
                for (x = 0; ; x++)
                    if (indiIDs[x][0] == -1)
                        continue;
                    else
                        if (idp.substring(1, idp.indexOf('@', 1)) == indiIDs[x][0]) {
                            rdata += indiIDs[x][1] + ".0  ";
                            break;
                        }
            }
            rdata += fName;
        }
    }
    rdata += os.EOL;
    rdata += "Mother - ";
    var idpw = misc.getParentID (gedcom, irec, "WIFE");
    if (idpw == '')
        rdata += "name unknown";
    else {
        /* get Mother's name & MELGenKey ID */
        mName = misc.getParentName (gedcom, irec, "WIFE");
        if (mName == "")
            rdata += "name unknown";
        else {
            idp = misc.getParentID (gedcom, irec, "WIFE");
            if (idp) {
                for (x = 0; ; x++)
                    if (indiIDs[x][0] == -1)
                        continue;
                    else
                        if (idp.substring(1, idp.indexOf('@', 1)) == indiIDs[x][0]) {
                            rdata += indiIDs[x][1] + ".0  ";
                            break;
                        }
            }
            rdata += mName;
        }
    }
    rdata += os.EOL;

    if (id2 != -1) {
        /* include spouse in Family Group Header Section */
        rdata += os.EOL;
        retitems = misc.extract0Rec (gedcom, "@" + id2 + "@", "INDI", 0);
        irecsp = retitems.str.trim();
        if (irecsp == "") {
            misc.Logging("***** INDI record for " + id2 + " does not exist in Gedcom! This should never happen. *****");
            return -1;
        }
        rdata += (gen + 1) + "." + suffix + "  ";
        retitems = misc.extractField (irecsp, "2", "GIVN", 0);
        if (retitems.str.trim() == '') {
            i2Name = "------";
            rdata += "------";                               // HOF given name
        } else {
            i2Name = retitems.str.trim();
            rdata += retitems.str.trim();                    // HOF given name
        }
        retitems = misc.extractField (irecsp, "2", "SURN", 0);
        if (retitems.str.trim() == '') {
            i2Name += " ------";
            rdata += " ------" + os.EOL;                    // HOF given name
        } else {
            i2Name += " " + retitems.str.trim();            // i2Name contains full name of INDI
            rdata += " " + retitems.str.trim() + os.EOL;    // HOF given name
        }

        /* Father & Mother lines */
        rdata += "Father - ";
        var idpsph = misc.getParentID (gedcom, irecsp, "HUSB");
        if (idpsph == '')
            rdata += "name unknown";
        else {
            /* get Father's name & MELGenKey ID */
            fName = misc.getParentName (gedcom, irecsp, "HUSB");
            if (fName == "")
                rdata += "name unknown";
            else {
                idp = misc.getParentID (gedcom, irecsp, "HUSB");
                if (idp) {
                    for (x = 0; ; x++)
                        if (indiIDs[x][0] == -1)
                            continue;
                        else
                            if (idp.substring(1, idp.indexOf('@', 1)) == indiIDs[x][0]) {
                                rdata += indiIDs[x][1] + ".0  ";
                                break;
                            }
                }
                rdata += fName;
            }
        }
        rdata += os.EOL;
        rdata += "Mother - ";
        var idpspw = misc.getParentID (gedcom, irecsp, "WIFE");
        if (idpspw == '')
            rdata += "name unknown";
        else {
            /* get Mother's name & MELGenKey ID */
            mName = misc.getParentName (gedcom, irecsp, "WIFE");
            if (mName == "")
                rdata += "name unknown";
            else {
                idp = misc.getParentID (gedcom, irecsp, "WIFE");
                if (idp) {
                    for (x = 0; ; x++)
                        if (indiIDs[x][0] == -1)
                            continue;
                        else
                            if (idp.substring(1, idp.indexOf('@', 1)) == indiIDs[x][0]) {
                                rdata += indiIDs[x][1] + ".0  ";
                                break;
                            }
                }
                rdata += mName;
            }
        }
        rdata += os.EOL;
    }

    /* Timeline & Notes sections */
    /* if there is no associated Source/Citation, do not add the event */

    i = prepProcessDate (i, "BIRT", "born", irec, "1", iName, "", notes, 0, 0);
    sect = misc.extractSect (irec, "1", "BAPM");
    if (sect != "")
        i = prepProcessDate (i, "BAPM", "baptized", irec, "1", iName, "", notes, 0, 0);
    else
        i = prepProcessDate (i, "CHR", "baptized", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "DEAT", "died", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "BURI", "buried", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "EMAIL", "email address", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "SSN", "SSN", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "ADDR", "living at", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "RESI", "living at", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "OCCU", "worked as a", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "ADOP", "adopted", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "NICK", "known as", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "ALIA", "known as", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "RELI", "a", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "CREM", "cremated", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "RETI", "retired", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "NATU", "naturalized", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "EMIG", "emigrated", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "IMMI", "immigrated", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "EDUC", "attended", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "GRAD", "graduated from", irec, "1", iName, "", notes, 0, 0);
    i = prepProcessDate (i, "DSCR", "described as", irec, "1", iName, "", notes, 0, 0);

    /* do the spouse only if there is a MARR record and a SOUR record */
    retitems = misc.extractField (family, "1", "MARR", 0);
    if (typeof retitems.str != "undefined" && retitems.str != "undefined") {
        retitems = misc.extractField (family, "2", "SOUR", 0);
        if (typeof retitems.str != "undefined" && retitems.str != "undefined") {
            /* get ID for spouse */
            retitems = misc.extractField (family, "1", "HUSB", 0);
            idt = retitems.str.trim();
            if (idt.substring(1, idt.length - 1) == id) {
                retitems = misc.extractField (family, "1", "WIFE", 0);
                idt = retitems.str;
            }
            /* extract INDI for ID */
            retitems = misc.extract0Rec (gedcom, idt, "INDI", 0);
            irec = retitems.str;
            if (irec == "") {
                misc.Logging("***** INDI record for " + idt + " does not exist in Gedcom! This should never happen. *****");
                return -1;
            }
            retitems = misc.extractField (irec, "2", "GIVN", 0);
            i2Name = retitems.str;
            retitems = misc.extractField (irec, "2", "SURN", 0);
            i2Name += retitems.str;                        // i2Name contains full name of INDI

            i = prepProcessDate (i, "BIRT", "born", irec, "1", i2Name, "", notes, 0, 1);
            sect = misc.extractSect (irec, "1", "BAPM");
            if (sect != "")
                i = prepProcessDate (i, "BAPM", "baptized", irec, "1", i2Name, "", notes, 0, 1);
            else
                i = prepProcessDate (i, "CHR", "baptized", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "DEAT", "died", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "BURI", "buried", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "SSN", "SSN", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "EMAIL", "email address", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "ADDR", "living at", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "RESI", "living at", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "OCCU", "worked as a", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "ADOP", "adopted", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "NICK", "known as", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "ALIA", "known as", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "RELI", "a", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "CREM", "cremated", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "RETI", "retired", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "NATU", "naturalized", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "EMIG", "emigrated", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "IMMI", "immigrated", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "EDUC", "attended", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "GRAD", "graduated from", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "DSCR", "described as", irec, "1", i2Name, "", notes, 0, 1);
            i = prepProcessDate (i, "MARR", "married", family, "1", iName, i2Name, notes, 0, 0);
        } else
            noSour++;
    }

    /* figure number of children in family */
    var numberOfChildren = 0, maxsp;
    for (x = 0; x < family.length; ) {
        retitems = misc.extractField (family, "1", "CHIL", x);
        x = retitems.e;
        if (typeof retitems.str != "undefined" && retitems.str == "undefined")
            break;
        else
            numberOfChildren++;
    }
    if (numberOfChildren == 1)
        maxsp = 2;
    if (numberOfChildren == 2)
        maxsp = 3;
    if (numberOfChildren > 2 && numberOfChildren < 8)
        maxsp = 4;
    if (numberOfChildren > 7 && numberOfChildren < 18)
        maxsp = 5;
    if (numberOfChildren > 17 && numberOfChildren < 28)
        maxsp = 6;
    if (numberOfChildren > 27)
        maxsp = 7;

    /* do each CHIL */
    for (x = 0; x < family.length; ) {
        retitems = misc.extractField (family, "1", "CHIL", x);
        x = retitems.e;
        idt = retitems.str.trim();
        if (typeof retitems.str != "undefined" && retitems.str == "undefined")
            /* no more children in FAM */
            break;
        else {
            retitems = misc.extract0Rec (gedcom, idt + " ", "INDI", 0);
            irec = retitems.str;
            var childrec = misc.findFam (gedcom, irec, "FAMS");
            if (childrec != 0 && childrec != -1) {
                retitems = misc.extractField (childrec, "1", "CHIL", 0);
                if (typeof retitems.str != "undefined" && retitems.str != "undefined") {
                    retitems = misc.extractField (childrec, "2", "SOUR", 0);
                    if (typeof retitems.str == "undefined" || retitems.str == "undefined") {
                       noSour++;
                       continue;        // if no SOUR, don't add child
                    }
                }
            }
            retitems = misc.extractField (irec, "2", "GIVN", 0);
            chName = retitems.str.trim();
            i = prepProcessDate (i, "BIRT", "born", irec, "1", chName, "", notes, numch + 1, numch + 2);

            /* Children Section */
            if (!numch)
                children = "Children:" + os.EOL + os.EOL;

            for (chFamsw = y = 0; y < indiIDs.length; y++)
                if (indiIDs[y][0] == -1)
                    continue;
                else
                    // ensure child's Family Group was indeed added
                    if (idt.substring(1, idt.indexOf('@', 1)) == indiIDs[y][0] && DBdata.indexOf("\n" + indiIDs[y][1] + ".0  ") != -1) {
                        children += indiIDs[y][1] + ".0  ";
                        chFamsw = 1;
                        break;
                    }
            var blanks = "          ";
            var trom = misc.romanize(numch + 1);
            children += trom + "." + blanks.substring(0, (maxsp - (trom.length - 1))) + chName.trim();
            if (children[children.length - 1] != ".")
                children += ".";
            /* add citation reference */
            if (!only1citation) {
                sect = misc.extractSect (irec, "2", "SOUR");       // already checked that it exists
                if (sect != "") {
                    for (thiscite = -1, y = 0; y < citationsFamGrp.length; y++)
                        if (citationsFamGrp[y][0] == sect.substring(sect.indexOf("@") + 1, sect.lastIndexOf("@")) ||
                                       (citationsFamGrp[y][0] == -1 && citationsFamGrp[y][1] == sect.substring(7, sect.indexOf("\n", 7)))) {
                            thiscite = y + 1;
                            break;
                        }
                    if (thiscite == -1) {
                        noSour++;
                        continue;     // SOUR reference for item/event not recorded; don't add child
                    } else
                        children += " [" + thiscite + "]";
                }
            }
            children += os.EOL;

            /* if the child does not have his or her own family, add his or her events (other than birth - already added) to this Family Group */
            if (!chFamsw) {
                sect = misc.extractSect (irec, "1", "BAPM");
                if (sect != "")
                    i = prepProcessDate (i, "BAPM", "baptized", irec, "1", chName, "", notes, numch + 1, numch + 2);
                else
                    i = prepProcessDate (i, "CHR", "baptized", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "DEAT", "died", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "BURI", "buried", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "SSN", "SSN", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "EMAIL", "email address", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "ADDR", "living at", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "RESI", "living at", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "OCCU", "worked as a", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "ADOP", "adopted", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "NICK", "known as", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "ALIA", "known as", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "RELI", "a", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "CREM", "cremated", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "RETI", "retired", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "NATU", "naturalized", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "EMIG", "emigrated", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "IMMI", "immigrated", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "EDUC", "attended", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "GRAD", "graduated from", irec, "1", chName, "", notes, numch + 1, numch + 2);
                i = prepProcessDate (i, "DSCR", "described as", irec, "1", chName, "", notes, numch + 1, numch + 2);
                /* get child's spouse if he/she married */
                var childfamily = misc.findFam (gedcom, irec, "FAMS");
                if (childfamily != 0 && childfamily != -1) {
                    retitems = misc.extractField (childfamily, "1", "MARR", 0);
                    if (typeof retitems.str != "undefined" && retitems.str != "undefined") {
                        retitems = misc.extractField (childfamily, "2", "SOUR", 0);
                        if (typeof retitems.str != "undefined" && retitems.str != "undefined") {
                            /* get ID for spouse */
                            retitems = misc.extractField (childfamily, "1", "HUSB", 0);
                            var idts = retitems.str.trim();
                            if (idts == idt) {
                                retitems = misc.extractField (childfamily, "1", "WIFE", 0);
                                idts = retitems.str.trim();
                            }
                            /* extract INDI for ID */
                            retitems = misc.extract0Rec (gedcom, idts, "INDI", 0);
                            var irecsp = retitems.str;
                            if (irecsp == "") {
                                misc.Logging("***** INDI record for " + idts + " does not exist in Gedcom! This should never happen. *****");
                                return -1;
                            }
                            retitems = misc.extractField (irecsp, "2", "GIVN", 0);
                            var i2Namesp = retitems.str.trim();
                            retitems = misc.extractField (irecsp, "2", "SURN", 0);
                            i2Namesp += " " + retitems.str.trim();                        // i2Namesp contains full name of INDI

                            i = prepProcessDate (i, "MARR", "married", childfamily, "1", chName, i2Namesp, notes, numch + 1, numch + 2);
                            /* add child's spouse's events */
                            i = prepProcessDate (i, "BIRT", "born", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            sect = misc.extractSect (irecsp, "1", "BAPM");
                            if (sect != "")
                                i = prepProcessDate (i, "BAPM", "baptized", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            else
                                i = prepProcessDate (i, "CHR", "baptized", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "DEAT", "died", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "BURI", "buried", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "SSN", "SSN", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "EMAIL", "email address", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "ADDR", "living at", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "RESI", "living at", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "OCCU", "worked as a", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "ADOP", "adopted", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "NICK", "known as", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "ALIA", "known as", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "RELI", "a", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "CREM", "cremated", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "RETI", "retired", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "NATU", "naturalized", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "EMIG", "emigrated", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "IMMI", "immigrated", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "EDUC", "attended", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "GRAD", "graduated from", irecsp, "1", i2Namesp, "", notes, 0, 0);
                            i = prepProcessDate (i, "DSCR", "described as", irecsp, "1", i2Namesp, "", notes, 0, 0);
                        } else
                            noSour++;
                    }
                }
            }
            numch++;
        }
    }

    var tlLength = timeline.length, swapped;

    /* sort Timeline items by date */
    for (i = 0; i < tlLength - 1; i++) {
        swapped = false;
		
        for (j = 0; j < tlLength - 1; j++) {
            /* compare the adjacent elements */
            if (timeline[j].yr > timeline[j + 1].yr) {
                /* swap them */
                [timeline[j], timeline[j + 1]] = [timeline[j + 1], timeline[j]];
                swapped = true;
            }
            if (timeline[j].yr == timeline[j + 1].yr) {
                if (timeline[j].mn > timeline[j + 1].mn) {
                    /* swap them */
                    [timeline[j], timeline[j + 1]] = [timeline[j + 1], timeline[j]];
                    swapped = true;
                }
                if (timeline[j].mn == timeline[j + 1].mn)
                    if (timeline[j].dy > timeline[j + 1].dy) {
                        /* swap them */
                        [timeline[j], timeline[j + 1]] = [timeline[j + 1], timeline[j]];
                        swapped = true;
                    }
            }
        }
        /* if no swap then array is now sorted; break the loop */
        if (swapped == false)
            break;
    }

    if (tlLength)
        rdata += os.EOL + "Timeline -" + os.EOL;
    for (i = 0; i < tlLength; i++) {
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        /* change numeric month to alpha */
        if (timeline[i].mn != -1)
            timeline[i].mn = months[timeline[i].mn];
        /* padding */
        if (timeline[i].dy < 10 && timeline[i].dy != -1)
            rdata += " ";
        if (timeline[i].dy != -1)
            rdata += timeline[i].dy + " ";
        else
            rdata += "   ";
        if (timeline[i].mn != -1)
            rdata += timeline[i].mn;
        else
            rdata += "   ";
        if (!timeline[i].dind && !timeline[i].cind)
            rdata += " ";
        if (timeline[i].dind)
            rdata += "d";
        if (timeline[i].cind)
            rdata += "c";
        rdata += timeline[i].yr + " " + timeline[i].txt + os.EOL;
    }

    /* Notes Section */
    var tcnt;
    for (x = tcnt = 0; x < notes.length; x++)
        if (notes[x] != "")
            tcnt++;
    if (tcnt)
        rdata += os.EOL + "Notes -" + os.EOL;
    else
        rdata += os.EOL;
    for (x = 0; x < notes.length; x++)
        if (notes[x] != "") {
            if (citationsFamGrp.length != 1) {
                var tnotes = notes[x].substring(notes[x].lastIndexOf(' [', notes[x].length));
                notes[x] = notes[x].substring(0, notes[x].lastIndexOf(' [', notes[x].length)) + ".";
                notes[x] += tnotes + os.EOL + os.EOL;
            } else
                notes[x] += "." + os.EOL + os.EOL;
            rdata += notes[x];
        }

    /* Citations section */
    if (citationsFamGrp[0][1] == "")
        return "";                    // Citations section is required

    if (citationsFamGrp.length == 1) {
        rdata += "Citation -" + os.EOL;
        rdata += citationsFamGrp[0][1] + os.EOL;
    } else {
        rdata += "Citations -" + os.EOL;
        for (x = 0; x < citationsFamGrp.length; x++)
            rdata += (x + 1) + ".  " + citationsFamGrp[x][1] + os.EOL;
    }
    rdata += os.EOL;

    /* Children Section */
    if (children == "")
        return "";                    // Children section is required
    else
        rdata += children;

    /* end of family group */
    rdata += os.EOL + os.EOL + os.EOL;

    return rdata;
}

function ProcessDate (passi, area, passno, namein, namein2, datein, placein, action, child, indx) {
    var i = passi, no = [], p, retitems, sect, thiscite, x;
    var tl = new Array();
    tl = { dy: "", mn: "", yr: "", txt: "", dind: "", cind: "" };
    no = passno;
    if (no.length <= indx)
        no.push("");

    sect = misc.extractSect (area, "2", "SOUR");
    if (sect != "") {
        for (thiscite = -1, x = 0; x < citationsFamGrp.length; x++)
            if (citationsFamGrp[x][0] == sect.substring(sect.indexOf("@") + 1, sect.lastIndexOf("@")) ||
                                     (citationsFamGrp[x][0] == -1 && citationsFamGrp[x][1] == sect.substring(7, sect.indexOf("\n", 7)))) {
                thiscite = x + 1;
                break;
            }
        if (thiscite == -1) {
            noSour++;
            return "";     // SOUR reference for item/event not recorded
        }
    } else {
        noSour++;
        return "";     // no SOUR; do not add event
    }

    if (only1citation && sect == "")
        thiscite = 1;
    if (!only1citation && sect == "")
        return {i: i, tl: tl, no: no};

    datein = datein.trim();
    if (typeof datein != "undefined" && datein != "undefined") {
        if (action == "living at")
            tl.txt = action;
        else
            if (action == "married")
                if (child)
                    tl.txt = "child #" + child + ", " + namein.trim() + ", and " + namein2.trim() + " " + action;
                else
                    tl.txt = namein.trim() + " and " + namein2.trim() + " " + action;
            else
                if (child)
                    tl.txt = "child #" + child + ", " + namein.trim() + ", " + action;
                else
                    tl.txt = namein.trim() + " " + action;
        tl.dind = 0;   /* double date */
        tl.cind = 0;   /* circa */
        if (datein[datein.length - 5] == 'd') {
            tl.dind = 1;
            datein[datein.length - 5] = ' ';
        }
        /* check for non-complete dates */
        if (datein.length == 4) {
            /* assume date is just a year */
            tl.yr = datein;
            tl.mn = -1;
            tl.dy = -1;
        } else {
            if (datein[datein.length - 5] == 'c' && datein.length < 7) {
                /* assume date is circa year */
                tl.cind = 1;
                tl.yr = datein.substring(datein.length - 4);
                tl.mn = -1;
                tl.dy = -1;
            } else {
                if (datein.length < 8) {
                    /* assume date is numeric month & year */
                    tl.yr = datein.substring (datein.length - 4);
                    tl.mn = datein.substring (0, datein.indexOf(" "));
                    tl.dy = -1;
                } else {
                    if (datein.length < 9) {
                        /* assume date is 3-position alpha month & year; convert month to numeric */
                        var months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
                        var month1 = datein.substring (0, 3);
                        var month2 = month1.toLowerCase();
                        tl.mn = months.indexOf(month2);
                        tl.yr = datein.substring (datein.length - 4);
                        tl.dy = -1;
                    } else {
                        var d = new Date(datein);
                        tl.dy = d.getDate();
                        tl.mn = d.getMonth();
                        tl.yr = d.getFullYear();
                    }
                }
            }
        }

        if (typeof placein != "undefined" && placein != "undefined")
            if (action == "living at")
                tl.txt += " " + placein;
            else
                tl.txt += " in " + placein;
        if (citationsFamGrp.length != 1)
            tl.txt += " [" + thiscite + "]";
        i++;
    } else
        if (typeof placein != "undefined" && placein != "undefined") {
            if (no[indx] == "") {
                if (child)
                    no[indx] = "Child #" + child + ", " + namein.trim() + ", ";
                else
                    no[indx] = namein.trim() + " ";
            } else
                if (citationsFamGrp.length != 1) {
                    /* semi-colon should be displayed before citation reference */
                    var tno = no[indx].substring(no[indx].lastIndexOf(' [', no[indx].length));
                    no[indx] = no[indx].substring(0, no[indx].lastIndexOf(' [', no[indx].length));
                    no[indx] += ";" + tno + " ";
                } else
                    no[indx] += "; ";
            if (action == "living at" && placein != "undefined")
                no[indx] += "lived at " + placein;
            else
                if (action == "married") {
                    no[indx] += "married " + namein2.trim();
                    if (placein != "undefined")
                        no[indx] += " in " + placein;
                } else {
                    no[indx] += action;
                    if (placein != "undefined")
                        no[indx] += " in " + placein;
                }
            if (citationsFamGrp.length != 1)
                no[indx] += " [" + thiscite + "]";
        } else {
            if (action == "email address" || action == "SSN") {
                if (no[indx] == "") {
                    if (child)
                        no[indx] = "Child #" + child + ", " + namein.trim() + ", ";
                    else
                        no[indx] = namein.trim() + " ";
                } else
                    if (citationsFamGrp.length != 1) {
                        /* semi-colon should be displayed before citation reference */
                        var tno = no[indx].substring(no[indx].lastIndexOf(' [', no[indx].length));
                        no[indx] = no[indx].substring(0, no[indx].lastIndexOf(' [', no[indx].length));
                        no[indx] += ";" + tno + " ";
                    } else
                        no[indx] += "; ";
                if (action == "SSN")
                    x = 6;
                else
                    x = 8;
                no[indx] += action + " " + area.substring(x, area.indexOf("\n", x));
            } else {
                if (no[indx] == "") {
                    if (child)
                        no[indx] = "Child #" + child + ", " + namein.trim() + ", ";
                    else
                        no[indx] = namein.trim() + " ";
                } else
                    if (citationsFamGrp.length != 1) {
                        /* semi-colon should be displayed before citation reference */
                        var tno = no[indx].substring(no[indx].lastIndexOf(' [', no[indx].length));
                        no[indx] = no[indx].substring(0, no[indx].lastIndexOf(' [', no[indx].length));
                        no[indx] += ";" + tno + " ";
                    } else
                        no[indx] += "; ";
                if (action == "married")
                    no[indx] += "married " + namein2.trim();
            }
            if (citationsFamGrp.length != 1)
                no[indx] += " [" + thiscite + "]";
        }

    return {i: i, tl: tl, no: no};
}

function addParents () {
    if (indiIDs[indiIDs.length - 1][2] != -1) {
        retitems = misc.extract0Rec (ged, '@' + indiIDs[indiIDs.length - 1][0] + '@ ', "INDI", 0);
        indirec = retitems.str;
        family = misc.findFam (ged, indirec, "FAMS");
    } else
        family = 0;
    if (family == 0 || family == -1) {
        indiIDs[indiIDs.length - 1][2] = -1;
        indiIDs[indiIDs.length - 1][3] = -1;
    } else {
        idp = misc.getParentID (ged, indirec, "HUSB");
        if (idp)
            indiIDs[indiIDs.length - 1][2] = idp.substring(1, idp.indexOf('@', 1));
        else
            indiIDs[indiIDs.length - 1][2] = -1;

        idp = misc.getParentID (ged, indirec, "WIFE");
        if (idp)
            indiIDs[indiIDs.length - 1][3] = idp.substring(1, idp.indexOf('@', 1));
        else
                indiIDs[indiIDs.length - 1][3] = -1;
    }
}

function prepProcessDate (interval, what, lit, irec, level, name, name2, section, who, indx) {
    var sect;

    sect = misc.extractSect (irec, level, what);
    if (sect != "") {
        retitems = misc.extractField (sect, "2", "SOUR", 0);
        if (typeof retitems.str != "undefined" && retitems.str != "undefined") {
            retitems = misc.extractField (sect, "2", "DATE", 0);
            edate = retitems.str;
            retitems = misc.extractField (sect, "2", "PLAC", 0);
            eplace = retitems.str.trim();
            retitems = ProcessDate (interval, sect, section, name, name2, edate, eplace, lit, who, indx);
            if (retitems != "") {
                if (interval < retitems.i) {
                    timeline[interval] = retitems.tl;
                    interval = retitems.i;
                }
                section = retitems.no;
            }
        } else
            noSour++;
    }
    return interval;
}

/* build array of all sources used by current Family Group */
function buildFamGrpCites (irec) {
    var b, x, y, z, thiscite;

    citationsFamGrp.length = 0;
    for (thiscite = -1, y = 0; y < irec.length; y = b + 1) {
        b = irec.indexOf("\n" + '2 SOUR', y);
        if (b == -1)
            break;

        for (x = 0; x < citations.length; x++)
            if (citations[x][0] != -1) {
                if (citations[x][0] == irec.substring(b + 9, irec.indexOf("\n", b + 9) - 1)) {
                    for (z = 0; z < citationsFamGrp.length; z++)
                        if (citationsFamGrp[z][0] == citations[x][0] && citationsFamGrp[z][1] == citations[x][1]) {
                            thiscite = 0;
                            x = citations.length;
                            break;
                        }
                    if (z == citationsFamGrp.length) {
                        citationsFamGrp.push([citations[x][0], citations[x][1]]);
                        thiscite = 0;
                        x = citations.length;
                    }
                }
            } else
                if (citations[x][1] == irec.substring(b + 8, irec.indexOf("\n", b + 8))) {
                    for (z = 0; z < citationsFamGrp.length; z++)
                        if (citationsFamGrp[z][1] == citations[x][1]) {
                            thiscite = 0;
                            x = citations.length;
                            break;
                        }
                    if (z == citationsFamGrp.length) {
                        citationsFamGrp.push([citations[x][0], citations[x][1]]);
                        thiscite = 0;
                        x = citations.length;
                    }
                }
    }
    return (thiscite)
}

/* from stackoverflow.com */
function convertToAscii(string) {
    const unicodeToAsciiMap = {'Ⱥ':'A','Æ':'AE','Ꜻ':'AV','Ɓ':'B','Ƀ':'B','Ƃ':'B','Ƈ':'C','Ȼ':'C','Ɗ':'D','ǲ':'D','ǅ':'D','Đ':'D','Ƌ':'D','Ǆ':'DZ','Ɇ':'E','Ꝫ':'ET','Ƒ':'F','Ɠ':'G','Ǥ':'G','Ⱨ':'H','Ħ':'H','Ɨ':'I','Ꝺ':'D','Ꝼ':'F','Ᵹ':'G','Ꞃ':'R','Ꞅ':'S','Ꞇ':'T','Ꝭ':'IS','Ɉ':'J','Ⱪ':'K','Ꝃ':'K','Ƙ':'K','Ꝁ':'K','Ꝅ':'K','Ƚ':'L','Ⱡ':'L','Ꝉ':'L','Ŀ':'L','Ɫ':'L','ǈ':'L','Ł':'L','Ɱ':'M','Ɲ':'N','Ƞ':'N','ǋ':'N','Ꝋ':'O','Ꝍ':'O','Ɵ':'O','Ø':'O','Ƣ':'OI','Ɛ':'E','Ɔ':'O','Ȣ':'OU','Ꝓ':'P','Ƥ':'P','Ꝕ':'P','Ᵽ':'P','Ꝑ':'P','Ꝙ':'Q','Ꝗ':'Q','Ɍ':'R','Ɽ':'R','Ꜿ':'C','Ǝ':'E','Ⱦ':'T','Ƭ':'T','Ʈ':'T','Ŧ':'T','Ɐ':'A','Ꞁ':'L','Ɯ':'M','Ʌ':'V','Ꝟ':'V','Ʋ':'V','Ⱳ':'W','Ƴ':'Y','Ỿ':'Y','Ɏ':'Y','Ⱬ':'Z','Ȥ':'Z','Ƶ':'Z','Œ':'OE','ᴀ':'A','ᴁ':'AE','ʙ':'B','ᴃ':'B','ᴄ':'C','ᴅ':'D','ᴇ':'E','ꜰ':'F','ɢ':'G','ʛ':'G','ʜ':'H','ɪ':'I','ʁ':'R','ᴊ':'J','ᴋ':'K','ʟ':'L','ᴌ':'L','ᴍ':'M','ɴ':'N','ᴏ':'O','ɶ':'OE','ᴐ':'O','ᴕ':'OU','ᴘ':'P','ʀ':'R','ᴎ':'N','ᴙ':'R','ꜱ':'S','ᴛ':'T','ⱻ':'E','ᴚ':'R','ᴜ':'U','ᴠ':'V','ᴡ':'W','ʏ':'Y','ᴢ':'Z','ᶏ':'a','ẚ':'a','ⱥ':'a','æ':'ae','ꜻ':'av','ɓ':'b','ᵬ':'b','ᶀ':'b','ƀ':'b','ƃ':'b','ɵ':'o','ɕ':'c','ƈ':'c','ȼ':'c','ȡ':'d','ɗ':'d','ᶑ':'d','ᵭ':'d','ᶁ':'d','đ':'d','ɖ':'d','ƌ':'d','ı':'i','ȷ':'j','ɟ':'j','ʄ':'j','ǆ':'dz','ⱸ':'e','ᶒ':'e','ɇ':'e','ꝫ':'et','ƒ':'f','ᵮ':'f','ᶂ':'f','ɠ':'g','ᶃ':'g','ǥ':'g','ⱨ':'h','ɦ':'h','ħ':'h','ƕ':'hv','ᶖ':'i','ɨ':'i','ꝺ':'d','ꝼ':'f','ᵹ':'g','ꞃ':'r','ꞅ':'s','ꞇ':'t','ꝭ':'is','ʝ':'j','ɉ':'j','ⱪ':'k','ꝃ':'k','ƙ':'k','ᶄ':'k','ꝁ':'k','ꝅ':'k','ƚ':'l','ɬ':'l','ȴ':'l','ⱡ':'l','ꝉ':'l','ŀ':'l','ɫ':'l','ᶅ':'l','ɭ':'l','ł':'l','ſ':'s','ẜ':'s','ẝ':'s','ɱ':'m','ᵯ':'m','ᶆ':'m','ȵ':'n','ɲ':'n','ƞ':'n','ᵰ':'n','ᶇ':'n','ɳ':'n','ꝋ':'o','ꝍ':'o','ⱺ':'o','ø':'o','ƣ':'oi','ɛ':'e','ᶓ':'e','ɔ':'o','ᶗ':'o','ȣ':'ou','ꝓ':'p','ƥ':'p','ᵱ':'p','ᶈ':'p','ꝕ':'p','ᵽ':'p','ꝑ':'p','ꝙ':'q','ʠ':'q','ɋ':'q','ꝗ':'q','ɾ':'r','ᵳ':'r','ɼ':'r','ᵲ':'r','ᶉ':'r','ɍ':'r','ɽ':'r','ↄ':'c','ꜿ':'c','ɘ':'e','ɿ':'r','ʂ':'s','ᵴ':'s','ᶊ':'s','ȿ':'s','ɡ':'g','ᴑ':'o','ᴓ':'o','ᴝ':'u','ȶ':'t','ⱦ':'t','ƭ':'t','ᵵ':'t','ƫ':'t','ʈ':'t','ŧ':'t','ᵺ':'th','ɐ':'a','ᴂ':'ae','ǝ':'e','ᵷ':'g','ɥ':'h','ʮ':'h','ʯ':'h','ᴉ':'i','ʞ':'k','ꞁ':'l','ɯ':'m','ɰ':'m','ᴔ':'oe','ɹ':'r','ɻ':'r','ɺ':'r','ⱹ':'r','ʇ':'t','ʌ':'v','ʍ':'w','ʎ':'y','ᶙ':'u','ᵫ':'ue','ꝸ':'um','ⱴ':'v','ꝟ':'v','ʋ':'v','ᶌ':'v','ⱱ':'v','ⱳ':'w','ᶍ':'x','ƴ':'y','ỿ':'y','ɏ':'y','ʑ':'z','ⱬ':'z','ȥ':'z','ᵶ':'z','ᶎ':'z','ʐ':'z','ƶ':'z','ɀ':'z','œ':'oe','ₓ':'x'};
    const stringWithoutAccents = string.normalize("NFD").replace(/[\u0300-\u036f]/g, '');
    return stringWithoutAccents.replace(/[^\u0000-\u007E]/g, character => unicodeToAsciiMap[character] || '');
}

module.exports = { GedChecks, ParseGedcom, createFiles };

