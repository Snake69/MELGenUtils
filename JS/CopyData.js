const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const misc = require ("./misc.js");

var includeCitations = Array(), includePeople = Array(), includeFG, includeCites, includePeeps, copy2Where;

async function CopyDB (pd) {
    /* user wants to copy active Family DataBase */
    var totalsize = 0, HOF, HOFpnt, CDBerrs = '', CDBmsgs = '';

    includeCitations = "";
    includePeople = "";
    includeFG = "";
    includeCites = pd.cite;
    includePeeps = pd.pics;

    if (misc.ProcessDBSysInfo("DBName") == -1)
        CDBerrs += "No Family DataBase is active. Activate a Family DataBase and resubmit the form.<br> <br>";

    if (CDBerrs == "") {
        if (misc.ProcessDBSysInfo("DBStatus") != 1 && misc.ProcessDBSysInfo("DBStatus") != 3)
            CDBmsgs += "The active Family DataBase is not verified. (It doesn't need to be verified to be copied, but it's better if it is.)" +
                       "<br> <br>";
        /* read family data */
        var rDB = misc.ReadFamilyDB ();
        if (!rDB) {
            CDBerrs += "There are no family files for the active DataBase.<br> <br>";
            return;
        }
        if (rDB == -2) {
            CDBerrs += "The DataBase is larger than 200MB and cannot be processed.<br> <br>";
            return;
        }
        if (pd.which == 2) {
            var nameHit = -1;

            /* find entered ID or name; if found, show HOF line to user so s/he can verify before proceeding */
            HOF = "";
            if (pd.id[0] >= '0' && pd.id[0] <= '9') {
                /* if first position of pd.id is numeric then treat it as a MELGenUtils ID (if user meant to enter a name, it's an
                   invalid name and won't match anything in DB) */
                nameHit = familydata.indexOf("\n\n\n" + pd.id);
                if (nameHit != -1)
                    nameHit += 3;            // point past newlines
            } else
                /* looking for a name */
                nameHit = familydata.indexOf("  " + pd.id);      
            if (nameHit != -1) {
                var EOL = familydata.lastIndexOf("\n", nameHit);
                /* go to beginning of HOF line */
                if (familydata[EOL - 1] == "\n" && familydata[EOL - 2] == "\n") {
                    HOFpnt = EOL + 1;
                    HOF = familydata.substring(HOFpnt, familydata.indexOf("\n", HOFpnt));
                }
                CDBmsgs += "The Family Group identified as '" + HOF + "' will be copied.<br> <br>";
            } else {
                CDBerrs += "Cannot find a Family Group with a Head of Family ";
                if (!isNaN(pd.id[0]))
                    CDBerrs += "ID ";
                else
                    CDBerrs += "name ";
                CDBerrs += "of '" + pd.id + "'.";
                if (misc.ProcessDBSysInfo("DBStatus") != 1 && misc.ProcessDBSysInfo("DBStatus") != 3) {
                    CDBerrs += " Since the active Family DataBase has not been verified, it's possible a format error within the DataBase " +
                              "could be causing this. If you believe that a Family Group with a";
                    if (!isNaN(pd.id[0]))
                        CDBerrs += "n ID ";
                    else
                        CDBerrs += " name ";
                    CDBerrs += "of '" + pd.id + "' actually does exist then run 'Verify Family Data' before trying to Copy Data.<br> <br>";
                }
            }
        }
    }

    /* accumulate Family Data for sizing; no need to do this if there are already fatal CDBerrs */
    if (CDBerrs == "") {
        var loc = misc.ProcessDBSysInfo("DBLocation");
        if (pd.which == 1) {
            /* accumulate sizes of all files recursively in directories:  PlainText, HTML & Other, and tableofcontents */
            if (fs.existsSync(path.join(loc, "tableofcontents")))
                totalsize += getSize (path.join(loc, "tableofcontents"));
            if (fs.existsSync(path.join(loc, "PlainText")))
                totalsize += getSize (path.join(loc, "PlainText"));
            if (fs.existsSync(path.join(loc, "HTML")))
                totalsize += getSize (path.join(loc, "HTML"));
            if (fs.existsSync(path.join(loc, "Other")))
                totalsize += getSize (path.join(loc, "Other"));
        } else {
            var familygroup = familydata.substring(HOFpnt, familydata.indexOf("\n\n\n", HOFpnt));
            includeFG = familygroup;
            totalsize += familygroup.length;
        }

        if (pd.cite == 1)
            if (pd.which == 1) {
                /* citation material; accumulate sizes of all files recursively in directories Reference & Images (except Images/People) */
                if (fs.existsSync(path.join(loc, "Images"))) {
                    fs.readdirSync(path.join(loc, "Images")).forEach(file => {
                        const Absolute = path.join(loc, "Images", file);
                        if (fs.statSync(Absolute).isDirectory() && file != "People")
                            /* the files in the People subdirectory are not really Citation files */
                            totalsize += getSize(Absolute);
                    })
                } else
                    CDBmsgs += "There are no images of citation material to include (the 'Images' directory/folder does not exist).<br> <br>";
                if (fs.existsSync(path.join(loc, "Reference")))
                    totalsize += getSize (path.join(loc, "Reference"));
                else
                    CDBmsgs += "There are no plain text citation materials to include (the 'Reference' directory/folder does not exist).<br> <br>";
            } else {
                var fpnt = 0, fbgn, flst, x, replaceResult, citearr = Array();
                while (1) {
                    fpnt = familygroup.indexOf("->", fpnt);
                    if (fpnt == -1)
                        break;
                    for (fbgn = fpnt; fbgn > 0; fbgn--)
                        if (familygroup[fbgn] == " " || familygroup[fbgn] == "\n" || familygroup[fbgn] == ">") {
                            fbgn++;
                            break;
                        }
                    if (fbgn)
                        if ((familygroup.substring(fbgn, fpnt) == "Reference") ||
                                         familygroup.substring(fbgn, fpnt) == "Biographies" || familygroup.substring(fbgn, fpnt) == "Maps" ||
                                         familygroup.substring(fbgn, fpnt) == "Misc" || familygroup.substring(fbgn, fpnt) == "Newspapers" ||
                                         familygroup.substring(fbgn, fpnt) == "Records") {
                            for (flst = fpnt + 2; familygroup[flst] != "\n"; flst++)
                                if (familygroup[flst] == " " || familygroup[flst] == ",")
                                    break;
                            x = 0;
                            replaceResult = familygroup.substring(fbgn, flst).replace(/->/g, "/");
                            while (x < citearr.length) {
                                if (replaceResult.substring(0,9) == "Reference")
                                    if (citearr[x] == replaceResult)
                                        break;
                                    if (citearr[x] == path.join("Images", replaceResult))
                                        break;
                                x++;
                            }
                            if (x == citearr.length) {
                                if (replaceResult.substring(0,9) == "Reference")
                                    citearr.push(replaceResult);
                                else
                                    citearr.push(path.join("Images", replaceResult));
                                if (fs.existsSync(path.join(loc, citearr[x])))
                                    totalsize += getSize (path.join(loc, citearr[x]));
                                else
                                    CDBmsgs += "The file '" + path.join(loc, citearr[x]) + "' does not exist " +
                                               "(this file is cited in the Family Group).<br> <br>";
                            }
                            fpnt = flst;
                        }
                    fpnt++;
                }
                includeCitations = citearr;
            }

        if (pd.pics == 1)
            if (pd.which == 1) {
                /* images of people; accumulate sizes of all files recursively in directory Images/People */
                var peopleimages = 0;
                if (fs.existsSync(path.join(loc, "Images")))
                    if (fs.existsSync(path.join(loc, "Images", "People")))
                        totalsize += getSize (path.join(loc, "Images", "People"));
                    else
                        CDBmsgs += "There are no images of people to include (the 'People' directory/folder does not exist within the 'Images' " +
                                   "directory/folder).<br> <br>";
                else
                    CDBmsgs += "There are no images of people to include (the 'Images' directory/folder does not exist).<br> <br>";
            } else {
                /* identify pertinent images of people to copy & accumulate size(s) */
                if (fs.existsSync(path.join(loc, "Images")))
                    if (fs.existsSync(path.join(loc, "Images", "People"))) {
                        var fpnt = 0, fbgn, flst, x, picarr = Array();
                        while (1) {
                            fpnt = familygroup.indexOf("->", fpnt);
                            if (fpnt == -1)
                                break;
                            for (fbgn = fpnt; fbgn > 0; fbgn--)
                                if (familygroup[fbgn] == " " || familygroup[fbgn] == "\n" || familygroup[fbgn] == ">") {
                                    fbgn++;
                                    break;
                                }
                            if (fbgn)
                                if (familygroup.substring(fbgn, fpnt) == "People") {
                                    for (flst = fpnt + 2; familygroup[flst] != "\n"; flst++)
                                        if (familygroup[flst] == " " || familygroup[flst] == ",")
                                            break;
                                    x = 0;
                                    while (x < picarr.length) {
                                        if (picarr[x] == familygroup.substring(fpnt + 2, flst))
                                            break;
                                        x++;
                                    }
                                    if (x == picarr.length) {
                                        picarr.push(familygroup.substring(fpnt + 2, flst));

                                        if (fs.existsSync(path.join(loc, "Images", "People", familygroup.substring(fpnt + 2, flst))))
                                            totalsize += getSize (path.join(loc, "Images", "People", familygroup.substring(fpnt + 2, flst)));
                                        else
                                            CDBmsgs += "The file '" + familygroup.substring(fpnt + 2, flst) + "' does not exist in the 'People'" +
                                                       " directory/folder (this file is referenced in the Family Group).<br> <br>";
                                    }
                                }
                            fpnt++;
                        }
                        includePeople = picarr;
                    } else
                        CDBmsgs += "There are no images of people to include (the 'People' directory/folder does not exist within the 'Images' " +
                                   "directory/folder).<br> <br>";
                else
                    CDBmsgs += "There are no images of people to include (the 'Images' directory/folder does not exist).<br> <br>";
            }

        CDBmsgs += "The Family Data";
        if (pd.which == 1)
            CDBmsgs += "Base ";
        else
            CDBmsgs += " ";
        CDBmsgs += "to be copied is " + totalsize + " bytes in size (or " + (totalsize / 1024).toFixed(2) + " KB, " +
                    (totalsize / 1024 / 1024).toFixed(2) + " MB, " + (totalsize / 1024 / 1024 / 1024).toFixed(2) + " GB)." + os.EOL + os.EOL;
        if (pd.out[0] == 1 || pd.out[0] == 3) {
            /* get location of output; if already exists check if there are contents; alert user */
            var outloc = pd.out.substring(2);
            if (path.isAbsolute(outloc))
                var fpath = path.normalize(outloc);                       // absolute path
            else
                if (outloc[0] == ".") {
                    var sysloc = misc.ProcessDBSysInfo("SysLocation");
                    var fpath = path.join (sysloc, outloc);               // relative path
                } else {
                    var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
                    var fpath = path.join (homedir, outloc);              // path base is home directory
                }
            copy2Where = pd.out[0] + " " + fpath;
            try {
                fs.accessSync(path.dirname(fpath), fs.constants.W_OK)
            }
            catch(e) {
                CDBerrs += "Permission settings won't allow creating '" + fpath + "'.<br> <br>";
            }
            if (fs.existsSync(fpath))
                if (pd.out[0] == 3)
                    CDBmsgs += "The PDF file '" + outloc + "' already exists. It will be backed up to '" + outloc + ".BACKUP' before copying. " +
                               "If the '" + outloc + ".BACKUP' file already exists it will be overwritten.<br> <br>";
                else
                    CDBmsgs += "The directory/folder '" + outloc + "' already exists. It will be backed up to '" + outloc + ".BACKUP' before " +
                               "copying. If the '" + outloc + ".BACKUP' directory/folder already exists it will be overwritten.<br> <br>";

            /* amount of free space in user's home directory */
            const freeSpaceBytes = freeSpace();
            if (freeSpaceBytes == -1)
                CDBmsgs += "Could not determine the amount of free space in user's home directory/folder.<br> <br>";
            else {
                CDBmsgs += "The amount of free space in user's home directory/folder is " + freeSpaceBytes + " bytes (or " +
                            (freeSpaceBytes / 1024).toFixed(2) + " KB, " + (freeSpaceBytes / 1024 / 1024).toFixed(2) + " MB, " +
                            (freeSpaceBytes / 1024 / 1024 / 1024).toFixed(2) + " GB).<br> <br>";
                if (freeSpaceBytes < totalsize)
                    CDBerrs += "There's not enough free disk space in order to perform the copy. Reduce the size of what is being copied and " +
                               "try again.<br> <br>";
            }
        }
    }
    if (CDBerrs == "")
        return CDBmsgs;
    else {
        CDBerrs = "ERRORS " + CDBerrs;
        return CDBerrs;
    }
}

/* do the actual copy */
function DoCopyDB () {
    /* create destination directory; if it already exists, back it up before copying */
    var retv, x;

    retv = misc.dirExist(path.normalize(copy2Where.substring(2)));
    if (!retv) {
        /* directory exists */
        try {
            if (!misc.dirExist(path.normalize(copy2Where.substring(2)) + ".BACKUP")) {
                try {
                    /* remove .BACKUP directory */
                    fs.rmSync(path.normalize(copy2Where.substring(2)) + ".BACKUP", { recursive: true, force: true });
                }
                catch (err) {
                    misc.Logging(err + "; problem deleting directory/folder '" + copy2Where.substring(2) + ".BACKUP'.");
                    misc.Logging("Copying of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "' failed.");
                    return -1;
                }
            }
            /* on Windows, renaming a directory which contains items doesn't seem to work; use copy & delete instead */
            fs.copySync(path.normalize(copy2Where.substring(2)), path.normalize(copy2Where.substring(2)) + ".BACKUP",
                        { recursive: true, overwrite: true });
            fs.rmSync(path.normalize(copy2Where.substring(2)), { recursive: true, force: true });
            misc.Logging ('"' + copy2Where.substring(2) + '" already exists. Backing it up before copying.');
            misc.Logging("Directory/folder '" + copy2Where.substring(2) + "' was backed up to '" + copy2Where.substring(2) + ".BACKUP'.");
            try {
                /* since the destination directory was renamed (deleted actually), it needs to be re-created */
                misc.dirExist(path.normalize(copy2Where.substring(2)));
            }
            catch (err) {
                misc.Logging(err + "; problem re-creating directory/folder '" + copy2Where.substring(2) + "'.");
                misc.Logging("Copying of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "' failed.");
                return -1;
            }
        }
        catch (err) {
            misc.Logging(err + "; problem backing up '" + copy2Where.substring(2) + "'.");
            misc.Logging("Copying of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "' failed.");
            return -1;
        }
    } else
        if (retv == -1) {
            /* error trying to create destination directory */
            misc.Logging ('Could not create "' + copy2Where.substring(2) + '" for copying.');
            misc.Logging("Copying of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "' failed.");
            return -1;
        }

    if (includeFG == "") {
        /* destination directory created; copy active Family DataBase */
        try {
            fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "tableofcontents"), path.join(copy2Where.substring(2), "tableofcontents"),
                        { overwrite: false });
        } catch (err) {
            misc.Logging(err + "; could not copy the 'tableofcontents' file in the root directory/folder of Family DataBase '" +
                         misc.ProcessDBSysInfo("DBName") + "' to '" + copy2Where.substring(2) + "'.");
            misc.Logging("Continuing with copy of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "'.");
        }
        try {
            fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "HTML"), path.join(copy2Where.substring(2), "HTML"), { overwrite: false });
        } catch (err) {
            misc.Logging(err + "; could not copy the 'HTML' directory/folder in Family DataBase '" +
                         misc.ProcessDBSysInfo("DBName") + "' to '" + copy2Where.substring(2) + "'.");
            misc.Logging("Continuing with copy of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "'.");
        }
        try {
            fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "Other"), path.join(copy2Where.substring(2), "Other"),
                        { recursive: true, overwrite: false });
        } catch (err) {
            misc.Logging(err + "; could not copy the 'Other' directory/folder in Family DataBase '" +
                         misc.ProcessDBSysInfo("DBName") + "' to '" + copy2Where.substring(2) + "'.");
            misc.Logging("Continuing with copy of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "'.");
        }
        try {
            fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "PlainText"), path.join(copy2Where.substring(2), "PlainText"),
                        { recursive: true, overwrite: false });
        } catch (err) {
            misc.Logging(err + "; could not copy the 'PlainText' directory/folder in Family DataBase '" +
                         misc.ProcessDBSysInfo("DBName") + "' to '" + copy2Where.substring(2) + "'.");
            misc.Logging("Copying of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "' failed.");
            return -1;
        }
        if (includeCites == 1 || includePeeps == 1) {
            retv = misc.dirExist(path.join(copy2Where.substring(2), "Images"));
            if (retv == -1) {
                /* error trying to create Images directory */
                misc.Logging ('Could not create "Images" directory/folder within "' + copy2Where.substring(2) + '" for copying.');
                misc.Logging ("Copying of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "' failed.");
                return -1;
            }
            if (includePeeps == 1) {
                try {
                    fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "Images", "People"),
                                path.join(copy2Where.substring(2), "Images", "People"), { recursive: true, overwrite: false });
                } catch (err) {
                    misc.Logging(err + "; could not copy images of people in Family DataBase '" + misc.ProcessDBSysInfo("DBName") +
                                       "' to '" + copy2Where.substring(2) + "/Images/People'.");
                    misc.Logging("Continuing with copy of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "'.");
                }
            }
            if (includeCites == 1) {
                try {
                    fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "Reference"), path.join(copy2Where.substring(2), "Reference"),
                                { recursive: true, overwrite: false });
                } catch (err) {
                    misc.Logging(err + "; could not copy the 'Reference' directory/folder in Family DataBase '" +
                                 misc.ProcessDBSysInfo("DBName") + "' to '" + copy2Where.substring(2) + "/Reference'.");
                    misc.Logging("Continuing with copy of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "'.");
                }
                /* read Images directory in DB & copy everything except the People directory */
                if (fs.existsSync(path.join(misc.ProcessDBSysInfo("DBLocation"), "Images")))
                    fs.readdirSync(path.join(misc.ProcessDBSysInfo("DBLocation"), "Images")).forEach(file => {
                        const Absolute = path.join(misc.ProcessDBSysInfo("DBLocation"), "Images", file);
                        if (file != "People") {
                            try {
                                fs.copySync(Absolute, path.join(copy2Where.substring(2), "Images", file), { recursive: true, overwrite: false });
                            } catch (err) {
                                misc.Logging(err + "; could not copy the '" + file +
                                                   "' directory/folder within the 'Images' directory/folder in Family DataBase '" +
                                             misc.ProcessDBSysInfo("DBName") + "' to '" + copy2Where.substring(2) + "/Images'.");
                                misc.Logging("Continuing with copy of Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "'.");
                            }
                        }
                    })
            }
        }
        misc.Logging("Family DataBase '" + misc.ProcessDBSysInfo("DBName") + "' copied to '" + copy2Where.substring(2) + "'.");
    } else {
        /* write Family Group to 'body' file */
        retv = misc.dirExist(path.join(copy2Where.substring(2), "PlainText"));
        if (retv == -1) {
            /* error trying to create 'PlainText' directory */
            misc.Logging ('Could not create "' + copy2Where.substring(2) + '/PlainText directory/folder for copying.');
            misc.Logging("Copying of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "' failed.");
            return -1;
        }
        var target = path.join(copy2Where.substring(2), "PlainText", "body");
        try {
            fs.writeFileSync(target, includeFG);
        }
        catch (err) {
            misc.Logging(err + "; problem creating '" + target + "'.");
            misc.Logging("Copying of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "' failed.");
            return -1;
        }
        /* copy 'Other' directory */
        try {
            fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "Other"), path.join(copy2Where.substring(2), "Other"),
                        { overwrite: false });
        } catch (err) {
            misc.Logging(err + "; could not copy the 'Other' directory/folder in Family DataBase '" + misc.ProcessDBSysInfo("DBName") +
                               "' to '" + copy2Where.substring(2) + "'.");
            misc.Logging("Continuing with copy of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "'.");
        }
        if (includeCites == 1) {
            /* copy selected citation material for Family Group */
            retv = misc.dirExist(path.join(copy2Where.substring(2), "Images"));
            if (retv == -1) {
                /* error trying to create Images directory */
                misc.Logging ('Could not create "Images" directory/folder within "' + copy2Where.substring(2) + '" for copying.');
                misc.Logging("Continuing with copy of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "'.");
            }
            retv = misc.dirExist(path.join(copy2Where.substring(2), "Reference"));
            if (retv == -1) {
                /* error trying to create 'Reference' directory */
                misc.Logging ('Could not create "Reference" directory/folder within "' + copy2Where.substring(2) + '" for copying.');
                misc.Logging("Continuing with copy of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "'.");
            }
            for (x = 0; x < includeCitations.length; x++)
                try {
                    fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), includeCitations[x]),
                                path.join(copy2Where.substring(2), includeCitations[x]), { overwrite: false });
                } catch (err) {
                    misc.Logging(err + "; problem copying '" + includeCitations[x] + "'to '" + copy2Where.substring(2) + "'.");
                    misc.Logging("Continuing with copy of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "'.");
                }
        }
        if (includePeeps == 1) {
            /* copy selected images of people for Family Group */
            retv = misc.dirExist(path.join(copy2Where.substring(2), "Images"));
            if (retv == -1) {
                /* error trying to create Images directory */
                misc.Logging ('Could not create "Images" directory/folder within "' + copy2Where.substring(2) + '" for copying.');
                misc.Logging ("Continuing with copy of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "'.");
            }
            retv = misc.dirExist(path.join(copy2Where.substring(2), "Images", "People"));
            if (retv == -1) {
                /* error trying to create Images directory */
                misc.Logging ('Could not create "People" directory/folder within "Images" directory/folder in ' + copy2Where.substring(2) +
                              '" for copying.');
                misc.Logging ("Continuing with copy of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "'.");
            }
            for (x = 0; x < includePeople.length; x++)
                try {
                    fs.copySync(path.join(misc.ProcessDBSysInfo("DBLocation"), "Images", "People", includePeople[x]),
                                path.join(copy2Where.substring(2), "Images", "People", includePeople[x]), { overwrite: false });
                } catch (err) {
                    misc.Logging(err + "; problem copying '" + includePeople[x] + "'to '" + copy2Where.substring(2) + "/Images/People'.");
                    misc.Logging ("Continuing with copy of Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "'.");
                }
        }
        misc.Logging("Family Group '" + includeFG.substring(0, includeFG.indexOf(" ")) + "' copied to '" + copy2Where.substring(2) + "'.");
    }
}

/* Get the size of a file or directory/folder recursively */
function getSize(p) {
    let size = 0;
    if (fs.statSync(path.normalize(p)).isDirectory()) {
        const files = fs.readdirSync(path.normalize(p));
        files.forEach(file => {
            size += getSize(path.join(p, file));
        })
    } else
        size += fs.statSync(path.normalize(p)).size;
    return size;
}

/* get amount of free disk space in user's home directory/folder in bytes */
function freeSpace() {
    try {
        var homedir = process.platform === "win32" ? process.env.HOMEPATH : process.env.HOME;
        const stats = fs.statfsSync(homedir);
        return (stats.bsize * stats.bfree);
    } catch (err) {
        return -1;
    }
}

module.exports = { CopyDB, DoCopyDB };
